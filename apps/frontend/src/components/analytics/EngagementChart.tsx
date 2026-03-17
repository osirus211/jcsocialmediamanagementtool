import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface EngagementChartProps {
  data: Array<any>;
  viewType: 'day' | 'platform';
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

const ENGAGEMENT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export function EngagementChart({ data, viewType, isLoading = false }: EngagementChartProps) {
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
          <p className="font-medium text-gray-900 mb-2">
            {viewType === 'day' ? formatDate(label) : label.charAt(0).toUpperCase() + label.slice(1)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="font-medium">{entry.name}:</span>
              <span className="text-gray-600">{formatNumber(entry.value)}</span>
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
          <div className="text-4xl mb-2">📊</div>
          <p className="text-lg font-medium">No engagement data available</p>
          <p className="text-sm">Engagement data will appear here once posts are published and analytics are collected.</p>
        </div>
      </div>
    );
  }

  if (viewType === 'day') {
    // Day view: grouped bars by platform per day
    return (
      <div className="h-80 w-full" role="img" aria-label="Engagement by day chart showing daily engagement breakdown by platform">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            <Legend />
            <Bar dataKey="likes" fill="#3B82F6" name="Likes" />
            <Bar dataKey="comments" fill="#10B981" name="Comments" />
            <Bar dataKey="shares" fill="#F59E0B" name="Shares" />
            <Bar dataKey="saves" fill="#EF4444" name="Saves" />
          </BarChart>
        </ResponsiveContainer>
        
        {/* Screen reader accessible data table */}
        <div className="sr-only">
          <table>
            <caption>Daily engagement data breakdown</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Shares</th>
                <th>Saves</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td>{row.date}</td>
                  <td>{row.likes}</td>
                  <td>{row.comments}</td>
                  <td>{row.shares}</td>
                  <td>{row.saves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else {
    // Platform view: single bar per platform
    return (
      <div className="h-80 w-full" role="img" aria-label="Engagement by platform chart showing total engagement per platform">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="platform" 
              stroke="#666"
              fontSize={12}
              tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
            />
            <YAxis 
              tickFormatter={formatNumber}
              stroke="#666"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="total" 
              fill="#3B82F6" 
              name="Total Engagement"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        
        {/* Screen reader accessible data table */}
        <div className="sr-only">
          <table>
            <caption>Platform engagement data totals</caption>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Shares</th>
                <th>Saves</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td>{row.platform}</td>
                  <td>{row.likes}</td>
                  <td>{row.comments}</td>
                  <td>{row.shares}</td>
                  <td>{row.saves}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}