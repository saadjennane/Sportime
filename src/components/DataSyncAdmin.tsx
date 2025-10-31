const syncLeagues = async (ids: string[]) => {
  if (!supabase) return;
  addProgress(`Syncing ${ids.length} leagues...`);
  try {
    for (const id of ids) {
      // ⚠️ id = API League ID (ex: "39")
      const data = await apiFootball<ApiLeagueInfo>('leagues', { id });
      if (data.results > 0) {
        const item = data.response[0];

        // countries
        await supabase
          .from('countries')
          .upsert({
            id: item.country.name,
            code: item.country.code,
            flag: item.country.flag,
          });

        // leagues → on écrit dans api_league_id (BIGINT) et on upsert sur ce champ
        const currentSeason =
          item.seasons.find((s: any) => s.current)?.year?.toString() || season;

        const up = {
          api_league_id: item.league.id,   // <-- clé API numérique
          name: item.league.name,
          logo: item.league.logo,
          type: item.league.type,
          season: currentSeason,
          country_id: item.country.name,
        };

        const { error: upErr } = await supabase
          .from('leagues')
          .upsert(up, { onConflict: 'api_league_id' });
        if (upErr) throw upErr;

        addProgress(`Synced league: ${item.league.name}`);
      }
    }
    addToast('Leagues synced successfully!', 'success');
  } catch (e: any) {
    addToast(`Error syncing leagues: ${e.message}`, 'error');
  }
};
