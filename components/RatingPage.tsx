import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Star, Send, ThumbsUp, Loader2, Bus, CalendarDays } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { appCatalog, matatus } from '../services/api';
import { AppRide } from '../types';

interface RatingPageProps {
  onBack: () => void;
  isDark: boolean;
  lang: 'en' | 'sw';
}

export const RatingPage: React.FC<RatingPageProps> = ({ onBack, isDark, lang }) => {
  const t = TRANSLATIONS[lang];
  const [rides, setRides] = useState<AppRide[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<string>('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRideHistory = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await appCatalog.getRides();
        const rideList = Array.isArray(response?.rides) ? response.rides : [];
        if (!cancelled) {
          setRides(rideList);
          if (rideList.length > 0) {
            setSelectedRideId(String(rideList[0].id));
          }
        }
      } catch (err: any) {
        const message = err.response?.data?.error || err.message || 'Failed to load ride history.';
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadRideHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRide = useMemo(
    () => rides.find((ride) => String(ride.id) === String(selectedRideId)) || null,
    [rides, selectedRideId]
  );

  const handleSubmit = async () => {
    if (!selectedRide?.matatu?.id || rating === 0) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const reviewTag = selectedRide.reference
        ? `ride-ref:${selectedRide.reference}`
        : `ride-id:${selectedRide.id}`;
      await matatus.postReview(String(selectedRide.matatu.id), rating, comment.trim(), reviewTag);
      setSubmitted(true);
      setTimeout(() => {
          onBack();
      }, 2000);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to submit rating.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
      return (
        <div className={`h-full flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in zoom-in ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <ThumbsUp className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-center">{t.ratingSuccess}</h2>
        </div>
      );
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`flex items-center gap-4 p-6 shadow-sm ${isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-white'}`}>
        <button onClick={onBack} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-800'}`}>
          <ArrowLeft />
        </button>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.rateRide}</h2>
      </div>

      <div className="p-6 flex-1 flex flex-col max-w-sm mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
            <h3 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.rateDesc}</h3>
            <p className="text-gray-500">Help us improve public transport in Eldoret.</p>
        </div>

        {isLoading && (
          <div className={`rounded-xl border p-4 text-sm flex items-center gap-2 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
            <Loader2 size={16} className="animate-spin" />
            Loading your rides...
          </div>
        )}

        {!isLoading && rides.length === 0 && (
          <div className={`rounded-xl border p-4 text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
            You have no completed fare rides yet.
          </div>
        )}

        {!isLoading && rides.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Select ride from history
              </label>
              <select
                value={selectedRideId}
                onChange={(e) => setSelectedRideId(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border font-medium focus:ring-2 focus:ring-yellow-500 outline-none transition-all ${
                  isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-black'
                }`}
              >
                {rides.map((ride) => {
                  const routeName = ride.matatu?.route?.name || ride.description || 'Ride';
                  return (
                    <option key={ride.id} value={String(ride.id)}>
                      {routeName} • KES {ride.amount}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedRide && (
              <div className={`rounded-xl border p-4 text-sm space-y-2 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                <div className="flex items-center gap-2">
                  <Bus size={16} className="text-yellow-500" />
                  <span className="font-semibold">{selectedRide.matatu?.plateNumber || 'Unknown matatu'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-yellow-500" />
                  <span>{new Date(selectedRide.date).toLocaleString()}</span>
                </div>
                <p>
                  {selectedRide.matatu?.route?.name || selectedRide.description}
                </p>
                {selectedRide.matatu?.driver && (
                  <p>Driver: {selectedRide.matatu.driver.name}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button 
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                >
                    <Star 
                        size={40} 
                        className={`${star <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} 
                    />
                </button>
            ))}
        </div>

        <div className="w-full">
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.commentPlaceholder}
                className={`w-full p-4 rounded-xl border h-32 resize-none focus:ring-2 focus:ring-yellow-500 outline-none transition-all ${
                    isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200'
                }`}
            />
        </div>

        <button
            onClick={handleSubmit}
            disabled={rating === 0 || !selectedRide?.matatu?.id || isSubmitting || isLoading || rides.length === 0}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{t.processing}</span>
              </>
            ) : (
              <>
                <span>{t.submitRating}</span>
                <Send size={18} />
              </>
            )}
        </button>

        {error && (
          <div className={`text-xs rounded-xl p-3 border ${
            isDark
              ? 'bg-red-900/30 border-red-700/40 text-red-200'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};