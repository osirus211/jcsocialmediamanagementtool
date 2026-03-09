/**
 * Reply Suggestion Prompts
 */

export function buildReplyPrompt(
  message: string,
  tone: string,
  platform: string,
  context?: string
): string {
  let prompt = `Generate 3 suggested replies to this ${platform} message:\n\n`;
  prompt += `Message: "${message}"\n\n`;
  
  if (context) {
    prompt += `Context: ${context}\n\n`;
  }
  
  prompt += `Tone: ${tone}\n`;
  prompt += `Platform: ${platform}\n\n`;
  prompt += `Provide 3 different reply options, numbered 1-3.`;
  
  return prompt;
}

export function buildSentimentAwareReplyPrompt(
  message: string,
  sentiment: 'positive' | 'negative' | 'neutral',
  platform: string
): string {
  let prompt = `Generate a ${sentiment}-sentiment-aware reply to this ${platform} message:\n\n`;
  prompt += `Message: "${message}"\n`;
  prompt += `Detected sentiment: ${sentiment}\n\n`;
  
  if (sentiment === 'negative') {
    prompt += `The message has negative sentiment. Respond professionally and empathetically.\n`;
  } else if (sentiment === 'positive') {
    prompt += `The message has positive sentiment. Respond warmly and enthusiastically.\n`;
  }
  
  prompt += `Generate only the reply, no explanations.`;
  
  return prompt;
}
