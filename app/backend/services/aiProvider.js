const axios = require('axios');
const logger = require('../config/pinoLogger');

class AIProvider {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'openai';
    this.apiKey = process.env.AI_API_KEY;
    this.model = process.env.AI_MODEL || 'gpt-4';
    this.timeout = parseInt(process.env.AI_TIMEOUT) || 5000; // 5 seconds default
  }

  async generateClinicalInsight(prompt, context) {
    try {
      if (this.provider === 'openai') {
        return await this.callOpenAI(prompt, context);
      } else if (this.provider === 'gemini') {
        return await this.callGemini(prompt, context);
      } else {
        throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      logger.error(`AI Provider Error [${this.provider}]: ${error.message}`);
      return { 
        error: 'AI_PROVIDER_FAILURE', 
        fallback: true,
        message: 'Could not generate AI insight. Relying on deterministic clinical rules.'
      };
    }
  }

  async callOpenAI(prompt, context) {
    // Standard OpenAI implementation with timeout
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a clinical decision support assistant. Provide structured, rule-aligned insights.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    }, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      timeout: this.timeout
    });

    return response.data.choices[0].message.content;
  }

  async callGemini(prompt, context) {
    // Placeholder for Gemini implementation
    throw new Error('Gemini provider not yet implemented');
  }
}

module.exports = new AIProvider();
