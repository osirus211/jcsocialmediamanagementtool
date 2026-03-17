// @ts-nocheck
import React from 'react';
import { LinkClickAnalytics as LinkClickData } from '@/types/analytics.types';

interface LinkClickAnalyticsProps {
  data: LinkClickData[];
  startDate: string;
  endDate: string;
  platform?: string;
}

export function LinkClickAnalytics({ data }: LinkClickAnalyticsProps) {
  return (
    <div className="space-y-4" role="img" aria-label="Link click analytics table showing click performance metrics">
      <h3 className="text-lg font-semibold">Link Click Analytics</h3>
      {data.length === 0 ? (
        <p className="text-gray-500">No link click data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-4 py-2 text-left">Period</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Total Clicks</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Unique Clicks</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-4 py-2">
                    {item.day || item.hour || item.country || item.device || 'N/A'}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">{item.totalClicks}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.uniqueClicks}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.conversionRate.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Screen reader accessible data table */}
      <div className="sr-only">
        <table>
          <caption>Link click performance metrics</caption>
          <thead>
            <tr>
              <th>Period</th>
              <th>Total Clicks</th>
              <th>Unique Clicks</th>
              <th>Conversion Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.day || item.hour || item.country || item.device || 'N/A'}</td>
                <td>{item.totalClicks}</td>
                <td>{item.uniqueClicks}</td>
                <td>{item.conversionRate.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}