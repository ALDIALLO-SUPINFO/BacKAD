const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendVerificationEmail(email, firstName, token) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
        
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Vérifiez votre compte AdVance',
            html: `
                <h1>Bonjour ${firstName},</h1>
                <p>Merci de vous être inscrit sur AdVance. Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
                <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Vérifier mon email</a>
                <p>Ce lien expire dans 24 heures.</p>
                <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
                <p>L'équipe AdVance</p>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error("Erreur d'envoi d'email:", error);
            return false;
        }
    }
}

module.exports = new EmailService();