# Reference applications

Reviewed source: 20 October 2026. These repositories guide features and analysis flows; the current Next.js/MongoDB app keeps its mobile-first interface.

## Statistical application

Reference: https://github.com/BVBtm86/buli_app

Relevant source:
- app.py: matchday, season table, team, player, goalkeeper and prediction sections.
- page_scripts/table_page.py: standings with home/away and season-half views.
- page_scripts/team_page.py: team versus opponent comparisons, league averages and season comparisons.
- page_scripts/player_page.py and gk_page.py: individual statistics and comparisons.
- page_scripts/stats_scripts/season_predictions.py: stored models output home/draw/away probabilities.

Apply the analytical structure to our data. Keep the agreed main navigation: Upcoming (only when unfinished fixtures exist), Results (latest finished matchday), Standings (full detailed filters). Club and player analysis should be reached from the relevant match or standing rather than adding generic Overview/Teams/Goal trends navigation back automatically.

The old prediction code is a reference, not a ready under/over model. It depends on saved models, transformers and a different feature schema. Goal-total probabilities will need their own time-based validation before being shown.

## Separate events and sequences application

Reference: https://github.com/BVBtm86/buli_event_app

Relevant source:
- app.py: match, team and player entry points and opponent/result/venue/season filters.
- page_scripts/game_page.py: lineups, event maps, passing networks, direction/distance and passing sequences.
- page_scripts/stats_scripts/game_stats.py: sequence construction and pitch visualization.

Start with a sequence explorer: select season, match, team and pass/shot sequence type; filter by half, minute range, player, sequence start/end reason and sequence length; select a sequence and inspect its ordered actions on a pitch and in a timeline.

Our Mongo collections already store the sequence boundaries. Group rows by game_id and sequence_key, order actions by sequence_event (with event_idx as a secondary key), and join game_schedule/game_lineups for fixture and player context. Sequence rows are individual actions, not one document per sequence. Count distinct sequence keys for sequence totals.

Use game_pass_sequences and game_shot_sequences as the sequence sources; use game_processed_events where extra event context is needed. Validate coordinate direction and receiver links before creating passing networks. Keep recorded coordinates; do not overwrite endpoints with the next action's position as the older visualization helper does.

## Migration approach

Both reference apps use Streamlit and Supabase, with older pinned dependencies and fixed season lists. Their queries and plotting code are not drop-in components for Next.js/MongoDB. Reuse the analysis concepts, adapt the data contract, and build responsive pitch/timeline interactions against the existing Mongo data. No reference Python code or saved prediction models were executed during this review.
