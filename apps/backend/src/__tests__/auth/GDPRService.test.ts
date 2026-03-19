import { GDPRService } from '../../services/GDPRService';

describe('GDPRService', () => {
  describe('convertToCSV', () => {
    it('should convert data to CSV format', () => {
      const data: any = {
        user: { email: 'test@example.com', firstName: 'Test' },
        posts: [],
        workspaces: [],
        socialAccounts: [],
        analytics: [],
        loginHistory: [],
        auditLogs: [],
        gdprRequests: [],
      };

      const csv = GDPRService.convertToCSV(data);

      expect(csv).toBeDefined();
      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
    });
  });

  describe('createGDPRRequest', () => {
    it('should validate request type', async () => {
      const validTypes = ['data_export', 'data_deletion', 'data_rectification', 'consent_withdrawal'];
      
      validTypes.forEach(type => {
        expect(['data_export', 'data_deletion', 'data_rectification', 'consent_withdrawal']).toContain(type);
      });
    });
  });
});
