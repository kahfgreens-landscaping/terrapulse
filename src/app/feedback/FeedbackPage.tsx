// src/app/feedback/FeedbackPage.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Star, Send, CheckCircle2, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NPS_LABELS: Record<number, string> = {
  0: 'Extremely unlikely', 1: '', 2: '', 3: '',
  4: '', 5: 'Neutral', 6: '', 7: '',
  8: '', 9: '', 10: 'Extremely likely',
};

export function FeedbackPage() {
  const { user } = useAuth();
  const [nps, setNps] = useState<number | null>(null);
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || nps === null || stars === 0) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        clientId: user.uid,
        projectId: '',
        npsScore: nps,
        starRating: stars,
        comment: comment.trim(),
        publishedToSite: false,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 bg-green-light rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-3">Thank you for your feedback!</h2>
          <p className="text-muted-foreground mb-6">
            Your review helps us serve you better. We truly appreciate it.
          </p>
          {stars === 5 && (
            <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 text-center">
              <ThumbsUp className="w-7 h-7 text-primary-600 mx-auto mb-2" />
              <p className="font-medium text-primary-800 mb-1">You gave us 5 stars! 🌟</p>
              <p className="text-sm text-primary-700 mb-3">
                Would you mind sharing your experience on Google?
              </p>
              <Button size="sm">Leave a Google Review</Button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold">Share Your Experience</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Help us improve by sharing your thoughts about our service
        </p>
      </div>

      <div className="space-y-5">
        {/* Star Rating */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall satisfaction</CardTitle>
              <CardDescription>How would you rate your experience?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHoveredStar(s)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setStars(s)}
                    className="transition-transform duration-100 hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'w-10 h-10 transition-colors',
                        s <= (hoveredStar || stars)
                          ? 'text-accent fill-accent'
                          : 'text-muted-foreground'
                      )}
                    />
                  </button>
                ))}
              </div>
              {stars > 0 && (
                <p className="text-center text-sm text-muted-foreground mt-3">
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][stars]}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* NPS */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How likely are you to recommend us?</CardTitle>
              <CardDescription>0 = Not likely, 10 = Extremely likely</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 flex-wrap justify-center">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNps(n)}
                    className={cn(
                      'w-10 h-10 rounded-xl text-sm font-semibold transition-all',
                      nps === n
                        ? n >= 9
                          ? 'bg-primary-600 text-white scale-110 shadow-green'
                          : n >= 7
                          ? 'bg-accent text-green-dark scale-110'
                          : 'bg-red-500 text-white scale-110'
                        : 'bg-muted hover:bg-primary-50 text-muted-foreground hover:text-primary-600'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {nps !== null && NPS_LABELS[nps] && (
                <p className="text-center text-sm text-muted-foreground mt-3">{NPS_LABELS[nps]}</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Comment */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Any additional comments?</CardTitle>
              <CardDescription>Your feedback is kept private and helps us improve.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Tell us what we did well, or how we can improve..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </CardContent>
          </Card>
        </motion.div>

        <Button
          className="w-full h-12"
          onClick={handleSubmit}
          disabled={loading || nps === null || stars === 0}
        >
          <Send className="w-4 h-4 mr-2" />
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  );
}
