/**
 * Content Repurposing Prompts
 */

export function buildRepurposingPrompt(
  originalContent: string,
  targetPlatform: string,
  originalPlatform?: string
): string {
  let prompt = `Adapt the following social media content for ${targetPlatform}:\n\n`;
  prompt += `Original content: "${originalContent}"\n\n`;
  
  if (originalPlatform) {
    prompt += `Original platform: ${originalPlatform}\n`;
  }
  
  prompt += `Target platform: ${targetPlatform}\n\n`;
  prompt += `Maintain the core message while adapting tone, length, and style for ${targetPlatform}.\n`;
  prompt += `Generate only the adapted content, no explanations.`;
  
  return prompt;
}
