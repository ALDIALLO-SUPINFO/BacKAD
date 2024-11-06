// src/services/pinterestService.js

const axios = require('axios');
const PinterestAccount = require('../models/PinterestAccount');
const PinterestCampaign = require('../models/PinterestCampaign');
const { PinterestError } = require('../src/utils/errors');

class PinterestService {
    constructor() {
        this.baseURL = process.env.PINTEREST_API_URL || 'https://api.pinterest.com/v5';
        this.client = null;
    }

    initialize(accessToken) {
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Intercepteur pour gérer les erreurs
        this.client.interceptors.response.use(
            response => response,
            error => {
                if (error.response) {
                    const { status, data } = error.response;
                    throw new PinterestError(
                        data.message || 'Pinterest API Error',
                        status,
                        data
                    );
                }
                throw error;
            }
        );
    }

    async verifyAccount(userId, token) {
        try {
            const response = await axios.get(`${this.baseURL}/user_account`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.data) {
                throw new Error('Invalid Pinterest response');
            }

            return response.data;
        } catch (error) {
            console.error('Pinterest verification error:', error);
            throw new PinterestError(
                'Failed to verify Pinterest account',
                error.response?.status,
                error.response?.data
            );
        }
    }

    async getAdAccounts(userId) {
        try {
            const account = await PinterestAccount.findOne({ userId });
            if (!account) {
                throw new Error('Pinterest account not found');
            }

            this.initialize(account.accessToken);
            const response = await this.client.get('/ad_accounts', {
                params: {
                    owner_user_id: account.pinterestId,
                    include_shared_accounts: true
                }
            });

            // Mettre à jour les comptes publicitaires dans la base de données
            if (response.data.items) {
                account.adAccounts = response.data.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    status: item.status,
                    currency: item.currency,
                    country: item.country,
                    lastSync: new Date()
                }));
                await account.save();
            }

            return response.data;
        } catch (error) {
            console.error('Error fetching ad accounts:', error);
            throw error;
        }
    }

    async createCampaign(userId, adAccountId, campaignData) {
        try {
            const account = await PinterestAccount.findOne({ userId });
            if (!account) {
                throw new Error('Pinterest account not found');
            }

            this.initialize(account.accessToken);

            // Formater les données pour l'API Pinterest
            const formattedData = this.formatCampaignData(campaignData);

            // Créer la campagne sur Pinterest
            const response = await this.client.post(
                `/ad_accounts/${adAccountId}/campaigns`,
                formattedData
            );

            // Créer la campagne dans notre base de données
            const campaign = new PinterestCampaign({
                userId,
                pinterestAccountId: account._id,
                adAccountId,
                campaignId: response.data.id,
                name: campaignData.name,
                status: response.data.status,
                objective: campaignData.objective,
                budget: {
                    daily: {
                        amount: campaignData.dailyBudget,
                        currency: campaignData.currency || 'EUR'
                    },
                    lifetime: campaignData.lifetimeBudget ? {
                        amount: campaignData.lifetimeBudget,
                        currency: campaignData.currency || 'EUR'
                    } : null
                },
                schedule: {
                    startDate: campaignData.startDate,
                    endDate: campaignData.endDate,
                    timezone: campaignData.timezone || 'UTC'
                },
                targeting: campaignData.targeting
            });

            await campaign.save();
            return campaign;
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    }

    async getCampaigns(userId, adAccountId, filters = {}) {
        try {
            const account = await PinterestAccount.findOne({ userId });
            if (!account) {
                throw new Error('Pinterest account not found');
            }

            this.initialize(account.accessToken);

            const response = await this.client.get(`/ad_accounts/${adAccountId}/campaigns`, {
                params: {
                    page_size: 100,
                    order: filters.order || 'DESCENDING',
                    sort_by: filters.sortBy || 'CREATED_TIME',
                    status: filters.status ? [filters.status] : undefined
                }
            });

            // Mettre à jour ou créer les campagnes dans notre base de données
            for (const item of response.data.items || []) {
                await PinterestCampaign.findOneAndUpdate(
                    { campaignId: item.id },
                    {
                        status: item.status,
                        'performance.total': {
                            impressions: item.summary_stats?.impressions || 0,
                            clicks: item.summary_stats?.clicks || 0,
                            spend: item.summary_stats?.spend || 0,
                            ctr: item.summary_stats?.ctr || 0
                        },
                        lastSync: new Date()
                    },
                    { new: true, upsert: true }
                );
            }

            return response.data;
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            throw error;
        }
    }

    async getAnalytics(userId, adAccountId, params) {
        try {
            const account = await PinterestAccount.findOne({ userId });
            if (!account) {
                throw new Error('Pinterest account not found');
            }

            this.initialize(account.accessToken);

            const response = await this.client.get(`/ad_accounts/${adAccountId}/analytics`, {
                params: {
                    start_date: params.startDate,
                    end_date: params.endDate,
                    columns: [
                        'SPEND',
                        'IMPRESSION',
                        'CLICK',
                        'CTR',
                        'ENGAGEMENT',
                        'ENGAGEMENT_RATE',
                        'CONVERSION',
                        'COST_PER_CONVERSION'
                    ].join(','),
                    level: params.level || 'CAMPAIGN',
                    click_window_days: params.clickWindowDays || 30
                }
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching analytics:', error);
            throw error;
        }
    }

    formatCampaignData(data) {
        return {
            name: data.name,
            status: data.status,
            objective_type: data.objective,
            daily_spend_cap: Math.round(data.dailyBudget * 1000000), // Convertir en micro-unités
            lifetime_spend_cap: data.lifetimeBudget ? Math.round(data.lifetimeBudget * 1000000) : undefined,
            start_time: data.startDate,
            end_time: data.endDate || null,
            tracking_urls: data.tracking?.urls || {},
            campaign_targeting: this.formatTargetingData(data.targeting || {})
        };
    }

    formatTargetingData(targeting) {
        return {
            geo_targeting: {
                locations: targeting.locations || []
            },
            demographic_targeting: {
                age_range: targeting.demographics?.ageRange,
                gender: targeting.demographics?.gender
            },
            interests: targeting.interests || [],
            keywords: targeting.keywords || []
        };
    }
}

module.exports = new PinterestService();