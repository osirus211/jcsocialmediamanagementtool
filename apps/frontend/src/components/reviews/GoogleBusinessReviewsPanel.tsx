import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Star, 
  MessageSquare, 
  Reply, 
  Trash2, 
  Send,
  Filter,
  Search,
  Calendar,
  User,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Review {
  name: string;
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: number;
  comment: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

interface GoogleBusinessReviewsPanelProps {
  accountId: string;
}

export function GoogleBusinessReviewsPanel({ accountId }: GoogleBusinessReviewsPanelProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'responded' | 'not-responded'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const responseTemplates = [
    "Thank you for your review! We appreciate your feedback.",
    "We're glad you had a positive experience with us!",
    "Thank you for taking the time to share your thoughts.",
    "We appreciate your business and your feedback!",
    "Thanks for the review! We're happy to hear from you.",
  ];

  useEffect(() => {
    fetchReviews();
  }, [accountId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/google-business/reviews/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();
      setReviews(data.data.reviews || []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch reviews. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) return;

    try {
      const response = await fetch(`/api/v1/google-business/reviews/${accountId}/${reviewId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ reply: replyText.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to post reply');
      }

      toast({
        title: 'Reply Posted',
        description: 'Your reply has been posted successfully.',
      });

      setReplyingTo(null);
      setReplyText('');
      fetchReviews(); // Refresh reviews
    } catch (error) {
      console.error('Failed to post reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to post reply. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/v1/google-business/reviews/${accountId}/${reviewId}/reply`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete reply');
      }

      toast({
        title: 'Reply Deleted',
        description: 'Your reply has been deleted successfully.',
      });

      fetchReviews(); // Refresh reviews
    } catch (error) {
      console.error('Failed to delete reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete reply. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const filteredAndSortedReviews = reviews
    .filter(review => {
      // Apply filter
      if (filter === 'responded' && !review.reviewReply) return false;
      if (filter === 'not-responded' && review.reviewReply) return false;
      
      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          review.comment.toLowerCase().includes(query) ||
          review.reviewer.displayName.toLowerCase().includes(query)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime();
        case 'oldest':
          return new Date(a.updateTime).getTime() - new Date(b.updateTime).getTime();
        case 'highest':
          return b.starRating - a.starRating;
        case 'lowest':
          return a.starRating - b.starRating;
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading reviews...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Google Business Reviews
            </CardTitle>
            <Button onClick={fetchReviews} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="not-responded">Not Responded</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Rating</SelectItem>
                <SelectItem value="lowest">Lowest Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="flex space-x-4 text-sm text-gray-600">
            <span>Total: {reviews.length}</span>
            <span>Responded: {reviews.filter(r => r.reviewReply).length}</span>
            <span>Pending: {reviews.filter(r => !r.reviewReply).length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredAndSortedReviews.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No reviews found</p>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedReviews.map((review) => (
            <Card key={review.reviewId}>
              <CardContent className="pt-6">
                {/* Review Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {review.reviewer.profilePhotoUrl ? (
                        <img
                          src={review.reviewer.profilePhotoUrl}
                          alt={review.reviewer.displayName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{review.reviewer.displayName}</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex">{renderStars(review.starRating)}</div>
                        <span className="text-sm text-gray-500">
                          {new Date(review.createTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {review.reviewReply ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Responded
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Review Content */}
                <div className="mb-4">
                  <p className="text-gray-700">{review.comment}</p>
                </div>

                {/* Existing Reply */}
                {review.reviewReply && (
                  <div className="bg-blue-50 border-l-4 border-blue-200 p-4 mb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 mb-1">Your Reply</p>
                        <p className="text-blue-800">{review.reviewReply.comment}</p>
                        <p className="text-xs text-blue-600 mt-2">
                          {new Date(review.reviewReply.updateTime).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReply(review.reviewId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reply Form */}
                {!review.reviewReply && (
                  <div className="border-t pt-4">
                    {replyingTo === review.reviewId ? (
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Write your reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={3}
                        />
                        
                        {/* Quick Templates */}
                        <div className="flex flex-wrap gap-2">
                          {responseTemplates.map((template, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              onClick={() => setReplyText(template)}
                              className="text-xs"
                            >
                              {template.substring(0, 30)}...
                            </Button>
                          ))}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleReply(review.reviewId)}
                            disabled={!replyText.trim()}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Post Reply
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setReplyingTo(review.reviewId)}
                      >
                        <Reply className="w-4 h-4 mr-1" />
                        Reply
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}