/**
 * Moderation Prompts
 */

export function buildModerationPrompt(
  content: string,
  platform: string,
  context?: string
): string {
  let prompt = `Analyze this ${platform} content for moderation:\n\n`;
  prompt += `Content: "${content}"\n\n`;
  
  if (context) {
    prompt += `Context: ${context}\n\n`;
  }
  
  prompt += `Evaluate for:\n`;
  prompt += `- Toxicity (hate speech, insults, threats)\n`;
  prompt += `- Spam (promotional content, excessive links)\n`;
  prompt += `- Harassment (bullying, stalking, abuse)\n`;
  prompt += `- Inappropriate content (explicit material)\n\n`;
  prompt += `Recommend one of: approve, reply, ignore, hide, flag, block\n`;
  prompt += `Provide confidence score (0-100) and reasons.`;
  
  return prompt;
}
