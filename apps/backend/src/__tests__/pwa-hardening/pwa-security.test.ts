import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

/**
 * PWA Security & Functionality Tests
 * 
 * Tests for P12 Mobile/PWA module hardening:
 * - Manifest configuration
 * - Service worker setup
 * - App icons (PNG required for Chrome)
 * - Mobile responsiveness
 * - Swipe gestures
 * - Web push notifications (gap documented)
 */

describe('PWA Security & Functionality Tests', () => {
  const frontendRoot = path.join(__dirname, '../../../../frontend');
  const publicDir = path.join(frontendRoot, 'public');
  const srcDir = path.join(frontendRoot, 'src');

  describe('Manifest Configuration', () => {
    let manifest: any;

    beforeAll(() => {
      const manifestPath = path.join(publicDir, 'manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    });

    it('should have required manifest fields', () => {
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.background_color).toBeDefined();
    });

    it('should include PNG icons for Chrome install prompt', () => {
      expect(manifest.icons).toBeDefined();
      expect(Array.isArray(manifest.icons)).toBe(true);
      
      const pngIcons = manifest.icons.filter((icon: any) => icon.type === 'image/png');
      expect(pngIcons.length).toBeGreaterThanOrEqual(2);
      
      const has192 = pngIcons.some((icon: any) => icon.sizes === '192x192');
      const has512 = pngIcons.some((icon: any) => icon.sizes === '512x512');
      
      expect(has192).toBe(true);
      expect(has512).toBe(true);
    });

    it('should have maskable icon for adaptive icons', () => {
      const maskableIcons = manifest.icons.filter((icon: any) => 
        icon.purpose && icon.purpose.includes('maskable')
      );
      expect(maskableIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('should include app shortcuts', () => {
      expect(manifest.shortcuts).toBeDefined();
      expect(Array.isArray(manifest.shortcuts)).toBe(true);
      expect(manifest.shortcuts.length).toBeGreaterThan(0);
      
      manifest.shortcuts.forEach((shortcut: any) => {
        expect(shortcut.name).toBeDefined();
        expect(shortcut.url).toBeDefined();
      });
    });
  });

  describe('Service Worker Setup', () => {
    it('should have VitePWA plugin configured', () => {
      const viteConfigPath = path.join(frontendRoot, 'vite.config.ts');
      expect(fs.existsSync(viteConfigPath)).toBe(true);
      
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      expect(viteConfig).toContain('VitePWA');
      expect(viteConfig).toContain('workbox');
      expect(viteConfig).toContain('registerType');
    });

    it('should have workbox runtime caching configured', () => {
      const viteConfigPath = path.join(frontendRoot, 'vite.config.ts');
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      
      expect(viteConfig).toContain('runtimeCaching');
      expect(viteConfig).toContain('NetworkFirst');
      expect(viteConfig).toContain('CacheFirst');
    });

    it('should include PNG icons in service worker assets', () => {
      const viteConfigPath = path.join(frontendRoot, 'vite.config.ts');
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      
      expect(viteConfig).toContain('includeAssets');
      expect(viteConfig).toContain('icon-192.png');
      expect(viteConfig).toContain('icon-512.png');
    });
  });

  describe('App Icons', () => {
    it('should have icon generation script', () => {
      const scriptPath = path.join(frontendRoot, 'scripts', 'generate-icons.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const script = fs.readFileSync(scriptPath, 'utf-8');
      expect(script).toContain('sharp');
      expect(script).toContain('icon-192.png');
      expect(script).toContain('icon-512.png');
    });

    it('should have source SVG icon', () => {
      const svgPath = path.join(publicDir, 'icons', 'icon.svg');
      expect(fs.existsSync(svgPath)).toBe(true);
    });
  });

  describe('PWA Components', () => {
    it('should have PWA install banner component', () => {
      const componentPath = path.join(srcDir, 'components', 'pwa', 'PWAInstallBanner.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have offline banner component', () => {
      const componentPath = path.join(srcDir, 'components', 'pwa', 'OfflineBanner.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have usePWAInstall hook', () => {
      const hookPath = path.join(srcDir, 'hooks', 'usePWAInstall.ts');
      expect(fs.existsSync(hookPath)).toBe(true);
    });

    it('should have useOfflineSupport hook', () => {
      const hookPath = path.join(srcDir, 'hooks', 'useOfflineSupport.ts');
      expect(fs.existsSync(hookPath)).toBe(true);
    });
  });

  describe('Mobile Swipe Gestures', () => {
    it('should have useSwipeGesture hook', () => {
      const hookPath = path.join(srcDir, 'hooks', 'useSwipeGesture.ts');
      expect(fs.existsSync(hookPath)).toBe(true);
      
      const hook = fs.readFileSync(hookPath, 'utf-8');
      expect(hook).toContain('onSwipeLeft');
      expect(hook).toContain('onSwipeRight');
      expect(hook).toContain('onTouchStart');
      expect(hook).toContain('onTouchMove');
      expect(hook).toContain('onTouchEnd');
      expect(hook).toContain('minSwipeDistance');
    });

    it('should implement swipe gestures in Calendar page', () => {
      const calendarPath = path.join(srcDir, 'pages', 'posts', 'Calendar.tsx');
      expect(fs.existsSync(calendarPath)).toBe(true);
      
      const calendar = fs.readFileSync(calendarPath, 'utf-8');
      expect(calendar).toContain('useSwipeGesture');
      expect(calendar).toContain('swipeHandlers');
      expect(calendar).toContain('...swipeHandlers');
    });

    it('should connect swipe to month/week navigation', () => {
      const calendarPath = path.join(srcDir, 'pages', 'posts', 'Calendar.tsx');
      const calendar = fs.readFileSync(calendarPath, 'utf-8');
      
      expect(calendar).toContain('nextMonth');
      expect(calendar).toContain('previousMonth');
      expect(calendar).toContain('nextWeek');
      expect(calendar).toContain('previousWeek');
    });
  });

  describe('Web Push Notifications (Known Gap)', () => {
    it('should have usePushNotifications hook documenting the gap', () => {
      const hookPath = path.join(srcDir, 'hooks', 'usePushNotifications.ts');
      expect(fs.existsSync(hookPath)).toBe(true);
      
      const hook = fs.readFileSync(hookPath, 'utf-8');
      expect(hook).toContain('KNOWN GAP');
      expect(hook).toContain('VAPID');
      expect(hook).toContain('REQUIRED IMPLEMENTATION');
      expect(hook).toContain('web-push');
    });

    it('should document backend requirements', () => {
      const hookPath = path.join(srcDir, 'hooks', 'usePushNotifications.ts');
      const hook = fs.readFileSync(hookPath, 'utf-8');
      
      expect(hook).toContain('Backend VAPID Keys');
      expect(hook).toContain('Backend Push Service');
      expect(hook).toContain('PushSubscription');
      expect(hook).toContain('/api/v1/push/subscribe');
    });

    it('should document frontend requirements', () => {
      const hookPath = path.join(srcDir, 'hooks', 'usePushNotifications.ts');
      const hook = fs.readFileSync(hookPath, 'utf-8');
      
      expect(hook).toContain('Frontend Implementation');
      expect(hook).toContain('Request notification permission');
      expect(hook).toContain('Register service worker');
    });

    it('should document security considerations', () => {
      const hookPath = path.join(srcDir, 'hooks', 'usePushNotifications.ts');
      const hook = fs.readFileSync(hookPath, 'utf-8');
      
      expect(hook).toContain('SECURITY CONSIDERATIONS');
      expect(hook).toContain('SSRF');
      expect(hook).toContain('Rate limit');
      expect(hook).toContain('audit');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should have responsive composer with mobile breakpoints', () => {
      const composerPath = path.join(srcDir, 'components', 'composer', 'ComposerContainer.tsx');
      expect(fs.existsSync(composerPath)).toBe(true);
      
      const composer = fs.readFileSync(composerPath, 'utf-8');
      expect(composer).toMatch(/sm:|md:|lg:/);
    });

    it('should have mobile-optimized calendar view', () => {
      const calendarPath = path.join(srcDir, 'pages', 'posts', 'Calendar.tsx');
      const calendar = fs.readFileSync(calendarPath, 'utf-8');
      
      // Should have keyboard shortcuts and touch handlers
      expect(calendar).toContain('handleKeyDown');
      expect(calendar).toContain('useSwipeGesture');
    });
  });
});
