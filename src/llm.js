// LLM API calls

import { settings } from './state.js';

export async function callLLM(prompt, systemPrompt = '') {
  const provider = settings.provider;

  if (provider === 'local') {
    return callLocalLLM(prompt, systemPrompt);
  } else {
    return callAnthropicLLM(prompt, systemPrompt);
  }
}

async function callLocalLLM(prompt, systemPrompt) {
  // Combine system prompt into user message for better compatibility
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt;

  const body = {
    messages: [
      { role: 'user', content: fullPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1000,
    stream: false
  };

  console.log('LLM request:', body);

  const response = await fetch(`${settings.localUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LLM error response:', errorText);
    throw new Error(`LLM request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('LLM response:', data);
  return data.choices[0].message.content;
}

async function callAnthropicLLM(prompt, systemPrompt) {
  // Note: This won't work directly from browser due to CORS
  // User would need to use a proxy or the Anthropic API allows browser requests
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function testConnection() {
  const provider = settings.provider;

  if (provider === 'local') {
    const response = await fetch(`${settings.localUrl}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      const modelName = data.data?.[0]?.id || 'Unknown model';
      return { success: true, message: `Connected! Model: ${modelName}` };
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } else {
    const key = settings.anthropicKey;
    if (!key) {
      return { success: false, message: 'Please enter an API key' };
    }
    // For Anthropic, we can't easily test without making a real request
    // Just validate the key format
    if (key.startsWith('sk-ant-')) {
      return { success: true, message: 'API key format looks valid' };
    } else {
      return { success: false, message: 'API key should start with sk-ant-', isWarning: true };
    }
  }
}
