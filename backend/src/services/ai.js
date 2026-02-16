/**
 * AI Service - GLM 5 Integration via Z.AI API
 */

const axios = require('axios');

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_MODEL = 'glm-5';

/**
 * Generate a proposal using GLM 5
 * @param {Object} params - Proposal parameters
 * @param {string} params.title - Project title
 * @param {string} params.description - Project description
 * @param {string} params.budget - Project budget
 * @param {string} params.skills - Required skills
 * @param {string} params.systemPrompt - System prompt
 * @param {string} params.userPromptTemplate - User prompt template
 * @returns {Promise<{proposal: string, model: string}>}
 */
async function generateProposal(params) {
  const { title, description, budget, skills, systemPrompt, userPromptTemplate } = params;
  
  // Replace placeholders in user prompt
  const userPrompt = userPromptTemplate
    .replace(/\{\{title\}\}/g, title || '')
    .replace(/\{\{description\}\}/g, description || '')
    .replace(/\{\{budget\}\}/g, budget || 'Not specified')
    .replace(/\{\{skills\}\}/g, skills || 'Not specified');

  const apiKey = process.env.GLM_API_KEY;
  
  if (!apiKey) {
    throw new Error('GLM_API_KEY not configured in environment');
  }

  try {
    const response = await axios.post(GLM_API_URL, {
      model: GLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout
    });

    const proposal = response.data?.choices?.[0]?.message?.content;
    
    if (!proposal) {
      throw new Error('No proposal content in API response');
    }

    return {
      proposal,
      model: GLM_MODEL,
      usage: response.data?.usage || null
    };
  } catch (error) {
    // Handle specific error types
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401 || status === 403) {
        throw new Error('Invalid or expired API key');
      }
      
      if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      throw new Error(`API error (${status}): ${data?.error?.message || 'Unknown error'}`);
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to AI service');
    }
    
    throw error;
  }
}

/**
 * Test API connection
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      return false;
    }
    
    // Simple test with minimal tokens
    await axios.post(GLM_API_URL, {
      model: GLM_MODEL,
      messages: [
        { role: 'user', content: 'Say "ok"' }
      ],
      max_tokens: 5
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    return true;
  } catch (error) {
    console.error('API connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  generateProposal,
  testConnection,
  GLM_MODEL
};
