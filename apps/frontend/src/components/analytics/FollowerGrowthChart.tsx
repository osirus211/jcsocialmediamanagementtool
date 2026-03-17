import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface FollowerGrowthChartProps {
  data: Array<{ date: string; platform: string; followerCount: number }>;
  isLoading?: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  threads: '#000000',
  bluesky: '#00A8E8',
};

export function FollowerGrowthChart({ data, isLoading = false }: FollowerGrowthChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!data || data.length === 0) {
      setChartData([]);
      return;
    }

    // Group data by date and create chart format
    const groupedData = data.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = { date };
      }
      acc[date][item.platform] = item.followerCount;
      return acc;
    }, {} as Record<string, any>);

    const chartArray = Object.values(groupedData).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    setChartData(chartArray);
  }, [data]);

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="capitalize font-medium">{entry.dataKey}:</span>
              <span className="text-gray-600">{formatNumber(entry.value)} followers</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse w-full h-full bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <p className="text-lg font-medium">No follower data available</p>
          <p className="text-sm">Follower data will appear here once your accounts are connected and synced.</p>
        </div>
      </div>
    );
  }

  // Get unique platforms for lines
  const platforms = Array.from(new Set(data.map(item => item.platform)));

  return (
    <div className="h-80 w-full" role="img" aria-label="Follower growth chart showing growth over time by platform">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            stroke="#666"
            fontSize={12}
          />
          <YAxis 
            tickFormatter={formatNumber}
            stroke="#666"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          {platforms.map((platform) => (
            <Line
              key={platform}
              type="monotone"
              dataKey={platform}
              stroke={PLATFORM_COLORS[platform] || '#8884d8'}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name={platform.charAt(0).toUpperCase() + platform.slice(1)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Screen reader accessible data table */}
      <div className="sr-only">
        <table>
          <caption>Follower growth data by platform over time</caption>
          <thead>
            <tr>
              <th>Date</th>
              {platforms.map(platform => (
                <th key={platform}>{platform} Followers</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, index) => (
              <tr key={index}>
                <td>{row.date}</td>
                {platforms.map(platform => (
                  <td key={platform}>{row[platform] || 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}