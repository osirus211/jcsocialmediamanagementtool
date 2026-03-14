import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Tag, 
  DollarSign, 
  ExternalLink,
  Info,
  Gift,
  ShoppingBag,
  Megaphone
} from 'lucide-react';

interface GoogleBusinessComposerFieldsProps {
  postType: 'STANDARD' | 'EVENT' | 'OFFER' | 'PRODUCT' | 'ALERT';
  onPostTypeChange: (type: 'STANDARD' | 'EVENT' | 'OFFER' | 'PRODUCT' | 'ALERT') => void;
  callToAction?: {
    actionType: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL';
    url: string;
  };
  onCallToActionChange: (cta: { actionType: string; url: string } | undefined) => void;
  event?: {
    title: string;
    startDate: string;
    endDate: string;
  };
  onEventChange: (event: { title: string; startDate: string; endDate: string } | undefined) => void;
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  onOfferChange: (offer: { couponCode?: string; redeemOnlineUrl?: string; termsConditions?: string } | undefined) => void;
  product?: {
    name: string;
    category?: string;
    price?: {
      currencyCode: string;
      units: string;
      nanos: number;
    };
  };
  onProductChange: (product: { name: string; category?: string; price?: { currencyCode: string; units: string; nanos: number } } | undefined) => void;
}

export function GoogleBusinessComposerFields({
  postType,
  onPostTypeChange,
  callToAction,
  onCallToActionChange,
  event,
  onEventChange,
  offer,
  onOfferChange,
  product,
  onProductChange,
}: GoogleBusinessComposerFieldsProps) {

  const postTypeOptions = [
    { value: 'STANDARD', label: 'Standard Post', icon: Info, description: 'Regular business update' },
    { value: 'EVENT', label: 'Event', icon: Calendar, description: 'Promote an upcoming event' },
    { value: 'OFFER', label: 'Offer', icon: Gift, description: 'Special promotion or discount' },
    { value: 'PRODUCT', label: 'Product', icon: ShoppingBag, description: 'Showcase a product' },
    { value: 'ALERT', label: 'Alert', icon: Megaphone, description: 'Important announcement' },
  ];

  const callToActionOptions = [
    { value: 'LEARN_MORE', label: 'Learn More' },
    { value: 'BOOK', label: 'Book' },
    { value: 'ORDER', label: 'Order' },
    { value: 'SHOP', label: 'Shop' },
    { value: 'SIGN_UP', label: 'Sign Up' },
    { value: 'CALL', label: 'Call' },
  ];

  const currencyOptions = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'CAD', label: 'CAD (C$)' },
    { value: 'AUD', label: 'AUD (A$)' },
  ];

  const formatDateTime = (date: string) => {
    if (!date) return '';
    return new Date(date).toISOString().slice(0, 16);
  };

  const parseDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return '';
    return new Date(dateTimeString).toISOString();
  };

  return (
    <div className="space-y-4">
      {/* Post Type Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Post Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {postTypeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = postType === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => onPostTypeChange(option.value as any)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className={`text-xs ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center">
            <ExternalLink className="w-4 h-4 mr-2" />
            Call to Action (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2">
            <Button
              variant={callToAction ? "outline" : "default"}
              size="sm"
              onClick={() => {
                if (callToAction) {
                  onCallToActionChange(undefined);
                } else {
                  onCallToActionChange({ actionType: 'LEARN_MORE', url: '' });
                }
              }}
            >
              {callToAction ? 'Remove CTA' : 'Add CTA'}
            </Button>
            {callToAction && (
              <Badge variant="secondary">
                {callToActionOptions.find(opt => opt.value === callToAction.actionType)?.label}
              </Badge>
            )}
          </div>
          
          {callToAction && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cta-type">Action Type</Label>
                <Select
                  value={callToAction.actionType}
                  onValueChange={(value) => 
                    onCallToActionChange({ ...callToAction, actionType: value as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {callToActionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="cta-url">URL</Label>
                <Input
                  id="cta-url"
                  type="url"
                  placeholder="https://example.com"
                  value={callToAction.url}
                  onChange={(e) => 
                    onCallToActionChange({ ...callToAction, url: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Fields */}
      {postType === 'EVENT' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                placeholder="Enter event title"
                value={event?.title || ''}
                onChange={(e) => 
                  onEventChange({ 
                    title: e.target.value,
                    startDate: event?.startDate || '',
                    endDate: event?.endDate || ''
                  })
                }
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-start">Start Date & Time</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={formatDateTime(event?.startDate || '')}
                  onChange={(e) => 
                    onEventChange({ 
                      title: event?.title || '',
                      startDate: parseDateTime(e.target.value),
                      endDate: event?.endDate || ''
                    })
                  }
                />
              </div>
              
              <div>
                <Label htmlFor="event-end">End Date & Time</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={formatDateTime(event?.endDate || '')}
                  onChange={(e) => 
                    onEventChange({ 
                      title: event?.title || '',
                      startDate: event?.startDate || '',
                      endDate: parseDateTime(e.target.value)
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offer Fields */}
      {postType === 'OFFER' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Gift className="w-4 h-4 mr-2" />
              Offer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="offer-coupon">Coupon Code (Optional)</Label>
              <Input
                id="offer-coupon"
                placeholder="e.g., SAVE20"
                value={offer?.couponCode || ''}
                onChange={(e) => 
                  onOfferChange({ 
                    ...offer,
                    couponCode: e.target.value
                  })
                }
              />
            </div>
            
            <div>
              <Label htmlFor="offer-url">Redeem Online URL (Optional)</Label>
              <Input
                id="offer-url"
                type="url"
                placeholder="https://example.com/offer"
                value={offer?.redeemOnlineUrl || ''}
                onChange={(e) => 
                  onOfferChange({ 
                    ...offer,
                    redeemOnlineUrl: e.target.value
                  })
                }
              />
            </div>
            
            <div>
              <Label htmlFor="offer-terms">Terms & Conditions (Optional)</Label>
              <Textarea
                id="offer-terms"
                placeholder="Enter terms and conditions..."
                value={offer?.termsConditions || ''}
                onChange={(e) => 
                  onOfferChange({ 
                    ...offer,
                    termsConditions: e.target.value
                  })
                }
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Fields */}
      {postType === 'PRODUCT' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Product Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="Enter product name"
                value={product?.name || ''}
                onChange={(e) => 
                  onProductChange({ 
                    ...product,
                    name: e.target.value
                  })
                }
              />
            </div>
            
            <div>
              <Label htmlFor="product-category">Category (Optional)</Label>
              <Input
                id="product-category"
                placeholder="e.g., Electronics, Clothing, Food"
                value={product?.category || ''}
                onChange={(e) => 
                  onProductChange({ 
                    ...product,
                    category: e.target.value
                  })
                }
              />
            </div>
            
            <div>
              <Label>Price (Optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={product?.price?.currencyCode || 'USD'}
                  onValueChange={(value) => 
                    onProductChange({ 
                      ...product,
                      price: {
                        currencyCode: value,
                        units: product?.price?.units || '0',
                        nanos: product?.price?.nanos || 0
                      }
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  value={product?.price?.units || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    const units = Math.floor(value).toString();
                    const nanos = Math.round((value - Math.floor(value)) * 1000000000);
                    
                    onProductChange({ 
                      ...product,
                      price: {
                        currencyCode: product?.price?.currencyCode || 'USD',
                        units,
                        nanos
                      }
                    });
                  }}
                />
                
                <div className="flex items-center px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                  <DollarSign className="w-4 h-4 mr-1" />
                  {product?.price?.units || '0'}.{String(product?.price?.nanos || 0).padStart(2, '0').slice(0, 2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}