# ─────────────────────────────────────────────────────────────────────────────
# Sportime — proprietary warehouse seeding (Transfermarkt via worldfootballR).
# Prototype: La Liga, a small season range. Pulls clubs → squads → players →
# transfer history (WITH FEES) → market values, and writes CSVs ready to load
# into Supabase (tm_* tables). Validate data quality before scaling to all leagues.
#
# Install once:
#   install.packages("worldfootballR"); install.packages("dplyr"); install.packages("readr")
# Run:
#   Rscript scripts/seed_transfermarkt.R
# ─────────────────────────────────────────────────────────────────────────────
suppressMessages({ library(worldfootballR); library(dplyr); library(readr); library(stringr) })
`%||%` <- function(a, b) if (is.null(a)) b else a   # null-coalesce helper

# ---- config: TOP 5 EUROPE, since 2000 ---------------------------------------
# Validate on a small slice FIRST (e.g. LEAGUES below = Spain only, SEASONS = 2022:2023)
# to judge quality + estimate time, THEN widen to the full target.
LEAGUES <- tibble::tribble(
  ~country,   ~league_id, ~league_name,
  "England",  "GB1",      "Premier League",
  "Spain",    "ES1",      "La Liga",
  "Italy",    "IT1",      "Serie A",
  "Germany",  "L1",       "Bundesliga",
  "France",   "FR1",      "Ligue 1"
)
SEASONS <- 2000:2024          # full target depth
OUT     <- "scripts/tm_out"
dir.create(OUT, showWarnings = FALSE, recursive = TRUE)
write_csv(LEAGUES %>% transmute(league_id, name = league_name, country), file.path(OUT, "tm_leagues.csv"))

tm_id <- function(url) suppressWarnings(as.numeric(str_match(url, "/(?:spieler|verein)/(\\d+)")[,2]))

# ---- 1) clubs of each league per season -------------------------------------
message("1/5 clubs per league/season …")
club_seasons <- list(); club_urls <- c()
for (li in seq_len(nrow(LEAGUES))) {
  lg <- LEAGUES[li, ]
  for (yr in SEASONS) {
    urls <- tryCatch(tm_league_team_urls(country_name = lg$country, start_year = yr), error = function(e) character(0))
    if (length(urls) == 0) next
    club_urls <- union(club_urls, urls)
    club_seasons[[paste(lg$league_id, yr)]] <- tibble(league_id = lg$league_id, season = yr, club_id = tm_id(urls), tm_url = urls)
    message("   ", lg$league_id, " ", yr, ": ", length(urls), " clubs")
  }
}
club_seasons <- bind_rows(club_seasons)
write_csv(club_seasons %>% select(league_id, season, club_id), file.path(OUT, "tm_club_seasons.csv"))
write_csv(club_seasons %>% distinct(club_id, tm_url), file.path(OUT, "tm_clubs.csv"))
message("   total distinct clubs: ", length(club_urls))

# ---- 2) squads per ACTUAL club-season -> player urls + memberships -----------
# NOTE: this is the heavy phase (Top5 x 25y ≈ a few thousand squads). worldfootballR
# self-rate-limits; expect hours. Run per-league or per-decade chunks if needed.
message("2/5 squads per club-season …")
cs <- club_seasons %>% distinct(tm_url, season)
memberships <- list(); player_urls <- c()
for (i in seq_len(nrow(cs))) {
  url <- cs$tm_url[i]; yr <- cs$season[i]
  sq <- tryCatch(tm_squad_stats(team_url = url, season_year = yr), error = function(e) NULL)
  if (is.null(sq) || nrow(sq) == 0) next
  pu <- sq$player_url %||% sq$url
  player_urls <- union(player_urls, pu)
  memberships[[paste(url, yr)]] <- tibble(
    player_id = tm_id(pu), club_id = tm_id(url), season = yr,
    age = sq$age %||% NA, market_value_eur = sq$player_market_value_euro %||% NA)
}
memberships <- bind_rows(memberships) %>% filter(!is.na(player_id))
write_csv(memberships, file.path(OUT, "tm_squad_memberships.csv"))
message("   distinct players: ", length(player_urls))

# ---- 3) player bio ----------------------------------------------------------
message("3/5 player bio …")
bio <- tm_player_bio(player_urls)
players <- tibble(
  player_id = tm_id(bio$player_url %||% bio$url), name = bio$player_name,
  full_name = bio$full_name %||% NA, date_of_birth = bio$date_of_birth %||% NA,
  birth_place = bio$place_of_birth %||% NA, nationality = bio$citizenship %||% NA,
  position = bio$position %||% NA, foot = bio$foot %||% NA,
  height_cm = suppressWarnings(as.integer(round(as.numeric(str_replace(bio$height %||% NA, "[^0-9,\\.]", "")) ))),
  current_market_value_eur = bio$current_value %||% NA, photo_url = bio$image_url %||% NA,
  tm_url = bio$player_url %||% bio$url)
write_csv(players, file.path(OUT, "tm_players.csv"))

# ---- 4) transfer history (WITH FEES) ----------------------------------------
message("4/5 transfer history (with fees) …")
tr <- tm_player_transfer_history(player_urls, get_extra_info = TRUE)
transfers <- tibble(
  player_id = tm_id(tr$player_url %||% tr$url), player_name = tr$player_name,
  season = tr$season, transfer_date = tr$transfer_date,
  from_club_name = tr$club_from %||% tr$team_from, to_club_name = tr$club_to %||% tr$team_to,
  from_country = tr$country_from %||% NA, to_country = tr$country_to %||% NA,
  is_loan = grepl("loan", tolower(tr$transfer_type %||% ""), fixed = FALSE),
  fee_eur = tr$transfer_fee %||% tr$fee,                # numeric euros; NA = unknown; 0 = free
  market_value_eur = tr$market_value)
write_csv(transfers, file.path(OUT, "tm_transfers.csv"))

# ---- 5) market value history ------------------------------------------------
message("5/5 market values …")
mv <- tryCatch(tm_player_market_values(country_name = COUNTRY, start_year = max(SEASONS)), error = function(e) NULL)
if (!is.null(mv)) write_csv(mv, file.path(OUT, "tm_market_values.csv"))

message("DONE — CSVs in ", OUT, " (load into Supabase tm_* tables).")
