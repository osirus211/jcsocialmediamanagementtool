import React, { useState, useEffect } from 'react';
import { Plus, Send, Trash2, Edit, Calendar, Mail, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { reportsService, ScheduledReport, CreateReportData } from '@/services/reports.service';

export function ScheduledReportsPanel() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateReportData>({
    name: '',
    frequency: 'weekly',
    format: 'pdf',
    reportType: 'overview',
    recipients: [],
    platforms: [],
    dateRange: 30,
    isActive: true,
  });

  const [recipientInput, setRecipientInput] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const data = await reportsService.listReports();
      setReports(data);
    } catch (err) {
      setError('Failed to load reports');
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateReport = () => {
    setEditingReport(null);
    setFormData({
      name: '',
      frequency: 'weekly',
      format: 'pdf',
      reportType: 'overview',
      recipients: [],
      platforms: [],
      dateRange: 30,
      isActive: true,
    });
    setRecipientInput('');
    setIsModalOpen(true);
  };

  const handleEditReport = (report: ScheduledReport) => {
    setEditingReport(report);
    setFormData({
      name: report.name,
      frequency: report.frequency,
      format: report.format,
      reportType: report.reportType,
      recipients: report.recipients,
      platforms: report.platforms,
      dateRange: report.dateRange,
      isActive: report.isActive,
    });
    setRecipientInput(report.recipients.join(', '));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Parse recipients from comma-separated input
      const recipients = recipientInput
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const submitData = { ...formData, recipients };

      if (editingReport) {
        await reportsService.updateReport(editingReport._id, submitData);
      } else {
        await reportsService.createReport(submitData);
      }

      setIsModalOpen(false);
      await loadReports();
    } catch (err) {
      setError('Failed to save report');
      console.error('Failed to save report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await reportsService.deleteReport(id);
      await loadReports();
    } catch (err) {
      setError('Failed to delete report');
      console.error('Failed to delete report:', err);
    }
  };

  const handleSendNow = async (id: string) => {
    try {
      await reportsService.sendNow(id);
      // TODO: Show success toast
    } catch (err) {
      setError('Failed to send report');
      console.error('Failed to send report:', err);
    }
  };

  const handleToggleActive = async (report: ScheduledReport) => {
    try {
      await reportsService.updateReport(report._id, { isActive: !report.isActive });
      await loadReports();
    } catch (err) {
      setError('Failed to update report');
      console.error('Failed to update report:', err);
    }
  };

  const formatNextSendDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Scheduled Reports</h3>
          <button
            onClick={handleCreateReport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Report
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No scheduled reports yet</h4>
            <p className="text-gray-600 mb-4">
              Create your first scheduled report to receive regular analytics updates via email.
            </p>
            <button
              onClick={handleCreateReport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Your First Report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report._id}
                className={`border rounded-lg p-4 ${
                  report.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={`font-medium ${report.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {report.name}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        report.frequency === 'daily' ? 'bg-green-100 text-green-700' :
                        report.frequency === 'weekly' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {report.frequency}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        report.format === 'pdf' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {report.format.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{report.reportType}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>{report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Next: {formatNextSendDate(report.nextSendAt)}</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      Recipients: {report.recipients.join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(report)}
                      className={`p-1 rounded transition-colors ${
                        report.isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'
                      }`}
                      title={report.isActive ? 'Disable report' : 'Enable report'}
                    >
                      {report.isActive ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleSendNow(report._id)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      title="Send now"
                    >
                      <Send className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleEditReport(report)}
                      className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      title="Edit report"
                    >
                      <Edit className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteReport(report._id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Delete report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingReport ? 'Edit Report' : 'Create New Report'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Format
                    </label>
                    <select
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pdf">PDF</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type
                  </label>
                  <select
                    value={formData.reportType}
                    onChange={(e) => setFormData({ ...formData, reportType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="overview">Overview</option>
                    <option value="posts">Posts Performance</option>
                    <option value="hashtags">Hashtag Analytics</option>
                    <option value="followers">Follower Growth</option>
                    <option value="full">Full Report</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipients (comma-separated emails)
                  </label>
                  <textarea
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="user@example.com, admin@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Range (days)
                  </label>
                  <input
                    type="number"
                    value={formData.dateRange}
                    onChange={(e) => setFormData({ ...formData, dateRange: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="365"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Active (report will be sent automatically)
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : editingReport ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}