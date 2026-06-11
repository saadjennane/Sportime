# ─────────────────────────────────────────────────────────────────────────────
# Sportime — proprietary warehouse seeding (Transfermarkt via worldfootballR DEV ≥0.6.8).
# League → clubs (per season) → squads (apps/goals) → players+bio+market value →
# FULL transfer history per player (with FEES). Writes CSVs for scripts/load_tm.mjs.
#   Install dev once: remotes::install_github("JaseZiv/worldfootballR")
#   Run: Rscript scripts/seed_transfermarkt.R
# ─────────────────────────────────────────────────────────────────────────────
suppressMessages({ library(worldfootballR); library(dplyr); library(readr); library(stringr); library(purrr) })
`%||%` <- function(a, b) if (is.null(a)) b else a

# ---- config -----------------------------------------------------------------
LEAGUES <- tibble::tribble(~country, ~league_id, ~name,  "Spain", "ES1", "La Liga")
SEASONS <- 2021:2025                 # La Liga, last 5 seasons (as of 2026)
MAX_TRANSFER_PLAYERS <- 150          # validation cap (set to Inf for the full run)
OUT <- "scripts/tm_out"; dir.create(OUT, showWarnings = FALSE, recursive = TRUE)
write_csv(LEAGUES %>% select(league_id, name, country), file.path(OUT, "tm_leagues.csv"))
tm_id  <- function(url) suppressWarnings(as.numeric(str_match(url, "/spieler/(\\d+)")[,2]))
ver_id <- function(url) suppressWarnings(as.numeric(str_match(url, "/verein/(\\d+)")[,2]))

# ---- 1) clubs per league/season ---------------------------------------------
message("1/4 clubs …")
cs <- list()
for (li in seq_len(nrow(LEAGUES))) for (yr in SEASONS) {
  urls <- tryCatch(tm_league_team_urls(country_name = LEAGUES$country[li], start_year = yr), error = function(e) character(0))
  if (length(urls)) cs[[paste(LEAGUES$league_id[li], yr)]] <- tibble(league_id = LEAGUES$league_id[li], season = yr, club_id = ver_id(urls), tm_url = urls)
}
cs <- bind_rows(cs)
write_csv(cs %>% select(league_id, season, club_id), file.path(OUT, "tm_club_seasons.csv"))

# ---- 2) squads per club-season -> memberships + season stats ----------------
message("2/4 squads (", nrow(cs), " club-seasons) …")
mem <- list(); pss <- list(); clubs <- list()
for (i in seq_len(nrow(cs))) {
  sq <- tryCatch(tm_squad_stats(team_url = cs$tm_url[i]), error = function(e) NULL)
  if (is.null(sq) || nrow(sq) == 0) next
  pid <- tm_id(sq$player_url)
  clubs[[i]] <- tibble(club_id = cs$club_id[i], name = sq$team_name[1], tm_url = cs$tm_url[i])
  mem[[i]] <- tibble(player_id = pid, club_id = cs$club_id[i], season = cs$season[i],
                     age = sq$player_age, market_value_eur = NA_real_)
  pss[[i]] <- tibble(player_id = pid, season = cs$season[i], league_id = cs$league_id[i],
                     club_id = cs$club_id[i], club_name = sq$team_name,
                     position = sq$player_pos, appearances = sq$appearances, goals = sq$goals, minutes = sq$minutes_played)
}
write_csv(bind_rows(clubs) %>% distinct(club_id, .keep_all = TRUE), file.path(OUT, "tm_clubs.csv"))
write_csv(bind_rows(mem) %>% filter(!is.na(player_id)) %>% distinct(player_id, club_id, season, .keep_all = TRUE), file.path(OUT, "tm_squad_memberships.csv"))
write_csv(bind_rows(pss) %>% filter(!is.na(player_id)) %>% distinct(player_id, season, club_id, league_id, .keep_all = TRUE), file.path(OUT, "tm_player_season_stats.csv"))

# ---- 3) players + bio + market value (per league/season) --------------------
message("3/4 players + market values …")
mv <- list()
for (li in seq_len(nrow(LEAGUES))) for (yr in SEASONS) {
  d <- tryCatch(tm_player_market_values(country_name = LEAGUES$country[li], start_year = yr), error = function(e) NULL)
  if (!is.null(d) && nrow(d)) mv[[paste(li, yr)]] <- d
}
mv <- bind_rows(mv)
players <- mv %>% arrange(desc(season_start_year)) %>% distinct(player_url, .keep_all = TRUE) %>% transmute(
  player_id = tm_id(player_url), name = player_name, date_of_birth = suppressWarnings(as.Date(player_dob, "%b %d, %Y")),
  nationality = player_nationality, position = player_position, foot = player_foot,
  height_cm = suppressWarnings(as.integer(round(as.numeric(player_height_mtrs) * 100))),
  current_market_value_eur = suppressWarnings(as.numeric(player_market_value_euro)), tm_url = player_url) %>% filter(!is.na(player_id))
write_csv(players, file.path(OUT, "tm_players.csv"))

# ---- 4) FULL transfer history per player (with fees) ------------------------
pool <- mv %>% distinct(player_url) %>% pull(player_url)
pool <- head(pool, MAX_TRANSFER_PLAYERS)
message("4/4 transfer history for ", length(pool), " players (polite, ~slow) …")
trs <- list()
for (j in seq_along(pool)) {
  url <- pool[j]; pid <- tm_id(url)
  th <- tryCatch(tm_player_transfer_history(player_urls = url), error = function(e) NULL)
  if (is.null(th) || nrow(th) == 0) next
  th <- th %>% arrange(transfer_date)
  trs[[j]] <- tibble(
    player_id = pid, player_name = th$player_name, season = th$season, transfer_date = th$transfer_date,
    from_club_name = th$team_from, to_club_name = th$team_to, from_country = th$country_from, to_country = th$country_to,
    is_loan = grepl("loan", tolower(th$transfer_type %||% "")),
    fee_eur = suppressWarnings(as.numeric(th$transfer_value)),
    market_value_eur = suppressWarnings(as.numeric(th$market_value)), seq = seq_len(nrow(th)))
  if (j %% 25 == 0) message("   ", j, "/", length(pool))
}
write_csv(bind_rows(trs), file.path(OUT, "tm_transfers.csv"))
message("DONE — CSVs in ", OUT, ". Load with: node scripts/load_tm.mjs")
