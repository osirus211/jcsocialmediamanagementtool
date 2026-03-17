import React from 'react';
import { CompetitorAnalytics } from '@/types/analytics.types';

interface CompetitorAnalysisTableProps {
  data: CompetitorAnalytics[];
  startDate: string;
  endDate: string;
  platform?: string;
}

export function CompetitorAnalysisTable({ data }: CompetitorAnalysisTableProps) {
  return (
    <div className="space-y-4" role="img" aria-label="Competitor analysis table showing competitor performance metrics">
      <h3 className="text-lg font-semibold">Competitor Analysis</h3>
      {data.length === 0 ? (
        <p className="text-gray-500">No competitor data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-4 py-2 text-left">Competitor</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Platform</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Followers</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Engagement Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((competitor, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-4 py-2">{competitor.competitorName}</td>
                  <td className="border border-gray-300 px-4 py-2">{competitor.platform}</td>
                  <td className="border border-gray-300 px-4 py-2">{competitor.followerCount.toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2">{competitor.avgEngagementRate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Screen reader accessible data table */}
      <div className="sr-only">
        <table>
          <caption>Competitor performance metrics</caption>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Platform</th>
              <th>Followers</th>
              <th>Engagement Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((competitor, index) => (
              <tr key={index}>
                <td>{competitor.competitorName}</td>
                <td>{competitor.platform}</td>
                <td>{competitor.followerCount.toLocaleString()}</td>
                <td>{competitor.avgEngagementRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}