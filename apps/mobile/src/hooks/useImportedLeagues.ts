import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface ImportedLeague {
  id: string;  // UUID returned as string from Supabase
  api_league_id: number;
  name: string;
  logo: string | null;
  country: string | null;
}

export const useImportedLeagues = () => {
  const [leagues, setLeagues] = useState<ImportedLeague[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('fb_leagues')
          .select('id, api_league_id, name, country, logo')
          .order('name');

        if (fetchError) throw fetchError;

        console.log('[useImportedLeagues] Fetched leagues from fb_leagues:', data);
        console.log('[useImportedLeagues] Number of leagues:', data?.length || 0);
        setLeagues(data || []);
      } catch (err) {
        console.error('Error fetching imported leagues:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch leagues');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  return { leagues, isLoading, error };
};
