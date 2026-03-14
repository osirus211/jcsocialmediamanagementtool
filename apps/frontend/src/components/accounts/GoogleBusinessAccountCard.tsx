import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Globe, 
  Star, 
  MessageSquare, 
  BarChart3,
  Unlink,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { SocialAccount } from '@/types/social.types';
import { useToast } from '@/hooks/use-toast';
import { disconnectSocialAccount } from '@/services/api/accounts';

interface GoogleBusinessAccountCardProps {
  account: SocialAccount;
  onDisconnect?: () => void;
}

export function GoogleBusinessAccountCard({ account, onDisconnect }: GoogleBusinessAccountCardProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await disconnectSocialAccount(account._id);
      
      toast({
        title: 'Account Disconnected',
        description: 'Google Business Profile account has been disconnected successfully.',
      });
      
      onDisconnect?.();
    } catch (error) {
      console.error('Failed to disconnect Google Business Profile account:', error);
      toast({
        title: 'Disconnection Failed',
        description: 'Failed to disconnect Google Business Profile account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Extract business location data from account metadata
  const businessData = account.metadata as any;
  const locationName = businessData?.locationName || businessData?.businessLocation?.name || account.accountName;
  const address = businessData?.address || businessData?.businessLocation?.address;
  const phoneNumber = businessData?.phoneNumber || businessData?.businessLocation?.phoneNumber;
  const websiteUrl = businessData?.websiteUrl || businessData?.businessLocation?.websiteUrl;
  const verificationState = businessData?.verificationState || businessData?.businessLocation?.verificationState;
  const rating = businessData?.rating || businessData?.businessLocation?.rating;
  const reviewCount = businessData?.reviewCount || businessData?.businessLocation?.reviewCount;

  const getVerificationBadge = () => {
    switch (verificationState) {
      case 'VERIFIED':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'UNVERIFIED':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unverified
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return null;
    
    if (typeof address === 'string') return address;
    
    // Handle structured address
    const parts = [];
    if (address.addressLines) parts.push(...address.addressLines);
    if (address.locality) parts.push(address.locality);
    if (address.administrativeArea) parts.push(address.administrativeArea);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.regionCode) parts.push(address.regionCode);
    
    return parts.join(', ');
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {locationName}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">Google Business Profile</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getVerificationBadge()}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Unlink className="w-4 h-4 mr-1" />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Business Information */}
        <div className="space-y-3">
          {address && (
            <div className="flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-600">{formatAddress(address)}</span>
            </div>
          )}
          
          {phoneNumber && (
            <div className="flex items-center space-x-3">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600">{phoneNumber}</span>
            </div>
          )}
          
          {websiteUrl && (
            <div className="flex items-center space-x-3">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a 
                href={websiteUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                {websiteUrl}
              </a>
            </div>
          )}
        </div>

        {/* Rating and Reviews */}
        {(rating || reviewCount) && (
          <div className="flex items-center space-x-4 pt-2 border-t border-gray-100">
            {rating && (
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium text-gray-900">{rating}</span>
              </div>
            )}
            
            {reviewCount && (
              <div className="flex items-center space-x-1">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex space-x-2 pt-2 border-t border-gray-100">
          <Button variant="outline" size="sm" className="flex-1">
            <MessageSquare className="w-4 h-4 mr-1" />
            Reviews
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <BarChart3 className="w-4 h-4 mr-1" />
            Insights
          </Button>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-xs text-gray-500">Connected</span>
          </div>
          <span className="text-xs text-gray-400">
            Connected {new Date(account.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}