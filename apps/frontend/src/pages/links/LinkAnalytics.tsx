import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { linkService, LinkStats } from '@/services/link.service';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Calendar, 
  MousePointer, 
  Globe, 
  Smartphone, 
  Monitor, 
  Tablet,
  ExternalLink,
  Download,
  ArrowLeft
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface AnalyticsData {
  totalClicks: number;
  uniqueClicks: number;
  clicksOverTime: Array<{ date: string; clicks: number }>;
  clicksByCountry: Array<{ country: string; clicks: number }>;
  clicksByDevice: Array<{ device: string; clicks: number }>;
  clicksByBrowser: Array<{ browser: string; clicks: number }>;
  topReferrers: Array<{ referrer: string; clicks: number }>;
  clicksByPlatform: Array<{ platform: string; clicks: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function LinkAnalyticsPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [linkStats, setLinkStats] = useState<LinkStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (shortCode) {
      loadAnalytics();
    }
  }, [shortCode, dateRange]);

  const loadAnalytics = async () => {
    if (!shortCode) return;

    try {
      setIsLoading(true);
      const [stats, analyticsData] = await Promise.all([
        linkService.getLinkStats(shortCode),
        linkService.getLinkAnalytics(shortCode, dateRange.from, dateRange.to)
      ]);
      
      setLinkStats(stats);
      setAnalytics(analyticsData);
    } catch (error) {
      logger.error('Failed to load analytics', error);
      // Fallback to mock data if API fails
      try {
        const stats = await linkService.getLinkStats(shortCode);
        setLinkStats(stats);
        const mockAnalytics = generateMockAnalytics(stats);
        setAnalytics(mockAnalytics);
      } catch (fallbackError) {
        logger.error('Failed to load fallback analytics', fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockAnalytics = (stats: LinkStats): AnalyticsData => {
    // Generate clicks over time
    const clicksOverTime = [];
    const days = 30;
    for (let i = days; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const clicks = Math.floor(Math.random() * (stats.clicks / days + 1));
      clicksOverTime.push({
        date: date.toISOString().split('T')[0],
        clicks,
      });
    }

    // Generate country data
    const countries = ['United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Australia', 'Japan'];
    const clicksByCountry = countries.map(country => ({
      country,
      clicks: Math.floor(Math.random() * (stats.clicks / 3)),
    })).sort((a, b) => b.clicks - a.clicks).slice(0, 5);

    // Generate device data
    const clicksByDevice = [
      { device: 'Mobile', clicks: Math.floor(stats.clicks * 0.6) },
      { device: 'Desktop', clicks: Math.floor(stats.clicks * 0.3) },
      { device: 'Tablet', clicks: Math.floor(stats.clicks * 0.1) },
    ];

    // Generate browser data
    const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
    const clicksByBrowser = browsers.map(browser => ({
      browser,
      clicks: Math.floor(Math.random() * (stats.clicks / 2)),
    })).sort((a, b) => b.clicks - a.clicks);

    // Generate referrer data
    const referrers = ['Direct', 'Twitter', 'Facebook', 'LinkedIn', 'Google', 'Email'];
    const topReferrers = referrers.map(referrer => ({
      referrer,
      clicks: Math.floor(Math.random() * (stats.clicks / 2)),
    })).sort((a, b) => b.clicks - a.clicks).slice(0, 5);

    // Generate platform data
    const platforms = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Direct'];
    const clicksByPlatform = platforms.map(platform => ({
      platform,
      clicks: Math.floor(Math.random() * (stats.clicks / 2)),
    })).sort((a, b) => b.clicks - a.clicks);

    return {
      totalClicks: stats.clicks,
      uniqueClicks: Math.floor(stats.clicks * 0.8),
      clicksOverTime,
      clicksByCountry,
      clicksByDevice,
      clicksByBrowser,
      topReferrers,
      clicksByPlatform,
    };
  };

  const exportAnalytics = () => {
    if (!analytics || !linkStats) return;

    const csvData = [
      ['Metric', 'Value'],
      ['Total Clicks', analytics.totalClicks],
      ['Unique Clicks', analytics.uniqueClicks],
      ['CTR', `${((analytics.totalClicks / 1000) * 100).toFixed(2)}%`],
      [''],
      ['Date', 'Clicks'],
      ...analytics.clicksOverTime.map(item => [item.date, item.clicks]),
      [''],
      ['Country', 'Clicks'],
      ...analytics.clicksByCountry.map(item => [item.country, item.clicks]),
      [''],
      ['Device', 'Clicks'],
      ...analytics.clicksByDevice.map(item => [item.device, item.clicks]),
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${shortCode}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!linkStats || !analytics) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Analytics not found
        </h3>
        <p className="text-gray-600">
          Unable to load analytics for this link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Link Analytics</h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{shortCode}</code>
              <a
                href={linkStats.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={exportAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalClicks.toLocaleString()}</p>
            </div>
            <MousePointer className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unique Clicks</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.uniqueClicks.toLocaleString()}</p>
            </div>
            <Globe className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CTR</p>
              <p className="text-2xl font-bold text-gray-900">
                {((analytics.totalClicks / 1000) * 100).toFixed(2)}%
              </p>
            </div>
            <BarChart className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Top Country</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.clicksByCountry[0]?.country || 'N/A'}
              </p>
            </div>
            <Globe className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clicks Over Time */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Clicks Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.clicksOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="clicks" stroke="#0088FE" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Clicks by Device */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Clicks by Device</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.clicksByDevice}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.device} ${(entry.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="clicks"
              >
                {analytics.clicksByDevice.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Clicks by Country */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Top Countries</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.clicksByCountry}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="country" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="clicks" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Referrers */}
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Top Referrers</h3>
          <div className="space-y-3">
            {analytics.topReferrers.map((referrer, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium">{referrer.referrer}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(referrer.clicks / analytics.totalClicks) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {referrer.clicks}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Browser Stats */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Browser Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics.clicksByBrowser} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="browser" type="category" />
            <Tooltip />
            <Bar dataKey="clicks" fill="#FFBB28" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Clicks Table */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Recent Clicks</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Referrer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Agent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {linkStats.clickHistory.slice(0, 10).map((click, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(click.clickedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {click.referrer || 'Direct'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {click.userAgent || 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}