// src/models/PinterestCampaign.js

const mongoose = require('mongoose');

const pinterestCampaignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    pinterestAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PinterestAccount',
        required: true
    },
    adAccountId: {
        type: String,
        required: true
    },
    campaignId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT'],
        default: 'DRAFT'
    },
    objective: {
        type: String,
        enum: ['AWARENESS', 'CONSIDERATION', 'CONVERSION'],
        required: true
    },
    budget: {
        daily: {
            amount: Number,
            currency: {
                type: String,
                default: 'EUR'
            }
        },
        lifetime: {
            amount: Number,
            currency: {
                type: String,
                default: 'EUR'
            }
        },
        spent: {
            amount: {
                type: Number,
                default: 0
            },
            currency: {
                type: String,
                default: 'EUR'
            }
        }
    },
    schedule: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: Date,
        timezone: String
    },
    targeting: {
        locations: [{
            type: {
                type: String,
                enum: ['COUNTRY', 'REGION', 'METRO'],
                default: 'COUNTRY'
            },
            id: String,
            name: String
        }],
        languages: [String],
        demographics: {
            ageRange: {
                min: {
                    type: Number,
                    min: 18,
                    max: 65
                },
                max: {
                    type: Number,
                    min: 18,
                    max: 65
                }
            },
            gender: {
                type: String,
                enum: ['ALL', 'MALE', 'FEMALE']
            }
        },
        interests: [{
            id: String,
            name: String,
            category: String
        }],
        keywords: [{
            text: String,
            matchType: {
                type: String,
                enum: ['BROAD', 'EXACT', 'PHRASE']
            }
        }]
    },
    creatives: [{
        id: String,
        type: {
            type: String,
            enum: ['PIN', 'IMAGE', 'VIDEO']
        },
        pinId: String,
        imageUrl: String,
        title: String,
        description: String,
        destinationUrl: String,
        status: {
            type: String,
            enum: ['ACTIVE', 'PAUSED', 'REJECTED']
        },
        statistics: {
            impressions: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            ctr: { type: Number, default: 0 },
            spend: { type: Number, default: 0 }
        }
    }],
    performance: {
        daily: [{
            date: Date,
            impressions: Number,
            clicks: Number,
            spend: Number,
            ctr: Number,
            conversions: Number,
            costPerConversion: Number
        }],
        total: {
            impressions: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            spend: { type: Number, default: 0 },
            ctr: { type: Number, default: 0 },
            conversions: { type: Number, default: 0 },
            costPerConversion: { type: Number, default: 0 }
        }
    },
    tracking: {
        urls: {
            impression: [String],
            click: [String]
        },
        parameters: {
            utm_source: String,
            utm_medium: String,
            utm_campaign: String,
            utm_content: String
        }
    },
    lastSync: {
        type: Date,
        default: Date.now
    },
    errors: [{
        code: String,
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Indexes pour optimiser les requêtes
pinterestCampaignSchema.index({ userId: 1, status: 1 });
pinterestCampaignSchema.index({ campaignId: 1 });
pinterestCampaignSchema.index({ pinterestAccountId: 1, status: 1 });

// Méthode pour calculer le budget restant
pinterestCampaignSchema.methods.getRemainingBudget = function() {
    if (this.budget.lifetime && this.budget.lifetime.amount) {
        return this.budget.lifetime.amount - this.budget.spent.amount;
    }
    return null;
};

// Méthode pour mettre à jour les statistiques
pinterestCampaignSchema.methods.updateStatistics = async function(newStats) {
    this.performance.total = {
        ...this.performance.total,
        ...newStats
    };
    
    // Ajouter aux statistiques journalières
    const today = new Date().toISOString().split('T')[0];
    const dailyStatsIndex = this.performance.daily.findIndex(
        stat => stat.date.toISOString().split('T')[0] === today
    );

    if (dailyStatsIndex > -1) {
        this.performance.daily[dailyStatsIndex] = {
            ...this.performance.daily[dailyStatsIndex],
            ...newStats
        };
    } else {
        this.performance.daily.push({
            date: new Date(),
            ...newStats
        });
    }

    this.lastSync = new Date();
    return this.save();
};

// Méthode pour vérifier si la campagne est active
pinterestCampaignSchema.methods.isActive = function() {
    const now = new Date();
    return (
        this.status === 'ACTIVE' &&
        this.schedule.startDate <= now &&
        (!this.schedule.endDate || this.schedule.endDate >= now)
    );
};

// Hook pre-save
pinterestCampaignSchema.pre('save', function(next) {
    // Calcul automatique du CTR
    if (this.performance.total.impressions > 0) {
        this.performance.total.ctr = 
            (this.performance.total.clicks / this.performance.total.impressions) * 100;
    }

    // Calcul du coût par conversion
    if (this.performance.total.conversions > 0) {
        this.performance.total.costPerConversion = 
            this.performance.total.spend / this.performance.total.conversions;
    }

    next();
});

const PinterestCampaign = mongoose.model('PinterestCampaign', pinterestCampaignSchema);

module.exports = PinterestCampaign;