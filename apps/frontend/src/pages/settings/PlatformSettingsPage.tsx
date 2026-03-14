import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw, Eye, Hash, Clock, Globe, Palette, Zap } from 'lucide-react';

import { platformSettingsService } from '@/services/platform-settings.service';
import { PlatformSettings } from '@/types/platform-settings.types';
import { SocialPlatform } from '@/types/social.types';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<Record<SocialPlatform, PlatformSettings>>({} as any);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SocialPlatform | null>(null);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>(SocialPlatform.TWITTER);
  
  const { accounts } = useSocialAccounts();
  const connectedPlatforms = Array.from(new Set(accounts.map(acc => acc.platform)));

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      const allSettings = await platformSettingsService.getAllSettings();
      
      // Create settings map with defaults for connected platforms
      const settingsMap: Record<SocialPlatform, PlatformSettings> = {} as any;
      
      for (const platform of connectedPlatforms) {
        const existingSetting = allSettings.find(s => s.platform === platform);
        if (existingSetting) {
          settingsMap[platform] = existingSetting;
        } else {
          // Get default template for platform
          const template = await platformSettingsService.getDefaultTemplate(platform);
          settingsMap[platform] = {
            workspaceId: '',
            platform,
            ...template
          } as PlatformSettings;
        }
      }
      
      setSettings(settingsMap);
      
      // Set first connected platform as active
      if (connectedPlatforms.length > 0) {
        setActivePlatform(connectedPlatforms[0]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (platform: SocialPlatform) => {
    try {
      setSaving(platform);
      const platformSettings = settings[platform];
      
      await platformSettingsService.updateSettings(platform, platformSettings);
      toast.success(`${platformSettingsService.getPlatformDisplayName(platform)} settings saved`);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const resetSettings = async (platform: SocialPlatform) => {
    try {
      await platformSettingsService.resetSettings(platform);
      const template = await platformSettingsService.getDefaultTemplate(platform);
      
      setSettings(prev => ({
        ...prev,
        [platform]: {
          workspaceId: '',
          platform,
          ...template
        } as PlatformSettings
      }));
      
      toast.success(`${platformSettingsService.getPlatformDisplayName(platform)} settings reset to defaults`);
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings');
    }
  };

  const updateSetting = (platform: SocialPlatform, path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings[platform];
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const addHashtag = (platform: SocialPlatform, hashtag: string) => {
    if (!hashtag.trim()) return;
    
    const cleanHashtag = hashtag.replace('#', '').trim();
    const currentHashtags = settings[platform]?.defaults?.defaultHashtags || [];
    
    if (!currentHashtags.includes(cleanHashtag)) {
      updateSetting(platform, 'defaults.defaultHashtags', [...currentHashtags, cleanHashtag]);
    }
  };

  const removeHashtag = (platform: SocialPlatform, hashtag: string) => {
    const currentHashtags = settings[platform]?.defaults?.defaultHashtags || [];
    updateSetting(platform, 'defaults.defaultHashtags', currentHashtags.filter(h => h !== hashtag));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (connectedPlatforms.length === 0) {
    return (
      <div className="text-center py-12">
        <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Connected Platforms</h3>
        <p className="text-muted-foreground">
          Connect social media accounts to configure platform-specific settings.
        </p>
      </div>
    );
  }

  const currentSettings = settings[activePlatform];
  const platformOptions = platformSettingsService.getPlatformConfigOptions(activePlatform);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">
          Configure default settings for each connected social media platform.
        </p>
      </div>

      <Tabs value={activePlatform} onValueChange={(value) => setActivePlatform(value as SocialPlatform)}>
        <TabsList className="grid w-full grid-cols-auto">
          {connectedPlatforms.map(platform => (
            <TabsTrigger key={platform} value={platform} className="flex items-center gap-2">
              <span>{platformSettingsService.getPlatformIcon(platform)}</span>
              {platformSettingsService.getPlatformDisplayName(platform)}
            </TabsTrigger>
          ))}
        </TabsList>

        {connectedPlatforms.map(platform => (
          <TabsContent key={platform} value={platform} className="space-y-6">
            {currentSettings && (
              <>
                {/* General Defaults */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      General Defaults
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Default Hashtags */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Default Hashtags
                      </Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {currentSettings.defaults?.defaultHashtags?.map(hashtag => (
                          <Badge 
                            key={hashtag} 
                            variant="secondary" 
                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => removeHashtag(platform, hashtag)}
                          >
                            #{hashtag} ×
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add hashtag (without #)"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addHashtag(platform, e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            addHashtag(platform, input.value);
                            input.value = '';
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Default First Comment */}
                    <div className="space-y-2">
                      <Label>Default First Comment</Label>
                      <Textarea
                        placeholder="Enter default first comment..."
                        value={currentSettings.defaults?.defaultFirstComment || ''}
                        onChange={(e) => updateSetting(platform, 'defaults.defaultFirstComment', e.target.value)}
                      />
                    </div>

                    {/* Default Visibility */}
                    <div className="space-y-2">
                      <Label>Default Visibility</Label>
                      <Select
                        value={currentSettings.defaults?.defaultVisibility || 'public'}
                        onValueChange={(value) => updateSetting(platform, 'defaults.defaultVisibility', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {platformOptions.visibilityOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* UTM Tracking */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>UTM Tracking</Label>
                        <Switch
                          checked={currentSettings.defaults?.utmTracking?.enabled || false}
                          onCheckedChange={(checked) => updateSetting(platform, 'defaults.utmTracking.enabled', checked)}
                        />
                      </div>
                      
                      {currentSettings.defaults?.utmTracking?.enabled && (
                        <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
                          <div className="space-y-2">
                            <Label>Source</Label>
                            <Input
                              placeholder="e.g., social"
                              value={currentSettings.defaults?.utmTracking?.source || ''}
                              onChange={(e) => updateSetting(platform, 'defaults.utmTracking.source', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Medium</Label>
                            <Input
                              placeholder="e.g., post"
                              value={currentSettings.defaults?.utmTracking?.medium || ''}
                              onChange={(e) => updateSetting(platform, 'defaults.utmTracking.medium', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Campaign</Label>
                            <Input
                              placeholder="e.g., summer2024"
                              value={currentSettings.defaults?.utmTracking?.campaign || ''}
                              onChange={(e) => updateSetting(platform, 'defaults.utmTracking.campaign', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Watermark */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Watermark
                        </Label>
                        <Switch
                          checked={currentSettings.defaults?.watermark?.enabled || false}
                          onCheckedChange={(checked) => updateSetting(platform, 'defaults.watermark.enabled', checked)}
                        />
                      </div>
                      
                      {currentSettings.defaults?.watermark?.enabled && (
                        <div className="space-y-4 pl-4 border-l-2 border-muted">
                          <div className="space-y-2">
                            <Label>Watermark Text</Label>
                            <Input
                              placeholder="Your brand name"
                              value={currentSettings.defaults?.watermark?.text || ''}
                              onChange={(e) => updateSetting(platform, 'defaults.watermark.text', e.target.value)}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Position</Label>
                              <Select
                                value={currentSettings.defaults?.watermark?.position || 'bottom-right'}
                                onValueChange={(value) => updateSetting(platform, 'defaults.watermark.position', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {platformOptions.watermarkPositions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Color</Label>
                              <Input
                                type="color"
                                value={currentSettings.defaults?.watermark?.color || '#FFFFFF'}
                                onChange={(e) => updateSetting(platform, 'defaults.watermark.color', e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Opacity: {currentSettings.defaults?.watermark?.opacity || 80}%</Label>
                            <Slider
                              value={[currentSettings.defaults?.watermark?.opacity || 80]}
                              onValueChange={([value]) => updateSetting(platform, 'defaults.watermark.opacity', value)}
                              max={100}
                              min={0}
                              step={5}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Font Size: {currentSettings.defaults?.watermark?.fontSize || 16}px</Label>
                            <Slider
                              value={[currentSettings.defaults?.watermark?.fontSize || 16]}
                              onValueChange={([value]) => updateSetting(platform, 'defaults.watermark.fontSize', value)}
                              max={48}
                              min={12}
                              step={2}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Posting Times */}
                    <div className="space-y-4">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Preferred Posting Times
                      </Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Timezone</Label>
                          <Select
                            value={currentSettings.defaults?.postingTime?.timezone || 'UTC'}
                            onValueChange={(value) => updateSetting(platform, 'defaults.postingTime.timezone', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="America/New_York">Eastern Time</SelectItem>
                              <SelectItem value="America/Chicago">Central Time</SelectItem>
                              <SelectItem value="America/Denver">Mountain Time</SelectItem>
                              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                              <SelectItem value="Europe/London">London</SelectItem>
                              <SelectItem value="Europe/Paris">Paris</SelectItem>
                              <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Platform-Specific Settings */}
                <PlatformSpecificSettings
                  platform={platform}
                  settings={currentSettings}
                  updateSetting={updateSetting}
                  platformOptions={platformOptions}
                />

                {/* Action Buttons */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => resetSettings(platform)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                  
                  <Button
                    onClick={() => saveSettings(platform)}
                    disabled={saving === platform}
                  >
                    {saving === platform ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Platform-specific settings component
function PlatformSpecificSettings({ 
  platform, 
  settings, 
  updateSetting, 
  platformOptions 
}: {
  platform: SocialPlatform;
  settings: PlatformSettings;
  updateSetting: (platform: SocialPlatform, path: string, value: any) => void;
  platformOptions: any;
}) {
  const platformConfig = settings.platformSpecific?.[platform];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{platformSettingsService.getPlatformIcon(platform)}</span>
          {platformSettingsService.getPlatformDisplayName(platform)} Specific Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {platform === SocialPlatform.TWITTER && (
          <>
            <div className="flex items-center justify-between">
              <Label>Create threads by default for long posts</Label>
              <Switch
                checked={(platformConfig as any)?.threadByDefault || false}
                onCheckedChange={(checked) => updateSetting(platform, 'platformSpecific.twitter.threadByDefault', checked)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Default poll duration</Label>
              <Select
                value={String((platformConfig as any)?.pollDuration || 24)}
                onValueChange={(value) => updateSetting(platform, 'platformSpecific.twitter.pollDuration', Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.pollDurations?.map((option: any) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Who can reply</Label>
              <Select
                value={(platformConfig as any)?.replySettings || 'everyone'}
                onValueChange={(value) => updateSetting(platform, 'platformSpecific.twitter.replySettings', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.replySettings?.map((option: any) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {platform === SocialPlatform.INSTAGRAM && (
          <>
            <div className="flex items-center justify-between">
              <Label>Put hashtags in first comment</Label>
              <Switch
                checked={(platformConfig as any)?.firstCommentHashtags || false}
                onCheckedChange={(checked) => updateSetting(platform, 'platformSpecific.instagram.firstCommentHashtags', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Enable alt text reminders</Label>
              <Switch
                checked={(platformConfig as any)?.altTextEnabled !== false}
                onCheckedChange={(checked) => updateSetting(platform, 'platformSpecific.instagram.altTextEnabled', checked)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Default aspect ratio</Label>
              <Select
                value={(platformConfig as any)?.aspectRatio || 'original'}
                onValueChange={(value) => updateSetting(platform, 'platformSpecific.instagram.aspectRatio', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.aspectRatios?.map((option: any) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Default location</Label>
              <Input
                placeholder="Enter default location"
                value={(platformConfig as any)?.defaultLocation || ''}
                onChange={(e) => updateSetting(platform, 'platformSpecific.instagram.defaultLocation', e.target.value)}
              />
            </div>
          </>
        )}

        {platform === SocialPlatform.LINKEDIN && (
          <>
            <div className="space-y-2">
              <Label>Target audience</Label>
              <Select
                value={(platformConfig as any)?.targetAudience || 'public'}
                onValueChange={(value) => updateSetting(platform, 'platformSpecific.linkedin.targetAudience', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.targetAudiences?.map((option: any) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Default content type</Label>
              <Select
                value={(platformConfig as any)?.contentType || 'post'}
                onValueChange={(value) => updateSetting(platform, 'platformSpecific.linkedin.contentType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.contentTypes?.map((option: any) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Enable boost by default</Label>
              <Switch
                checked={(platformConfig as any)?.boostEnabled || false}
                onCheckedChange={(checked) => updateSetting(platform, 'platformSpecific.linkedin.boostEnabled', checked)}
              />
            </div>
          </>
        )}

        {/* Add more platform-specific settings as needed */}
        
        {!platformConfig && (
          <p className="text-muted-foreground text-sm">
            No platform-specific settings available for {platformSettingsService.getPlatformDisplayName(platform)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}