# Connections data: for the top notable players, scrape FULL transfer history (clubs)
# + honours (achievements /erfolge/ page). Writes CSVs for tm_transfers + tm_trophies.
suppressMessages({ library(worldfootballR); library(dplyr); library(readr); library(rvest); library(httr); library(stringr) })
`%||%` <- function(a, b) if (is.null(a)) b else a
tm_id <- function(url) suppressWarnings(as.numeric(str_match(url, "/spieler/(\\d+)")[,2]))

players <- read_csv("scripts/tm_out/tm_players.csv", show_col_types=FALSE)
bio <- tryCatch(read_csv("scripts/tm_out/tm_players_bio.csv", show_col_types=FALSE), error=function(e) NULL)
if (!is.null(bio)) players <- players %>% left_join(bio %>% select(player_id, max_market_value_eur), by="player_id")
players <- players %>% mutate(val = coalesce(max_market_value_eur, current_market_value_eur, 0)) %>% arrange(desc(val))
N <- 500
pool <- head(players, N)
message("enriching ", nrow(pool), " players (transfers + honours) …")

UA <- "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
honours_url <- function(url) sub("/profil/", "/erfolge/", url)
scrape_honours <- function(url) {
  pg <- tryCatch(read_html(httr::GET(honours_url(url), httr::add_headers(`User-Agent`=UA), httr::timeout(20))), error=function(e) NULL)
  if (is.null(pg)) return(character(0))
  t <- pg %>% html_elements("h2, .content-box-headline, .table-header") %>% html_text2() %>% trimws()
  t[str_detect(t, "^\\d+x\\s+")]
}

trs <- list(); tro <- list()
for (i in seq_len(nrow(pool))) {
  url <- pool$tm_url[i]; pid <- tm_id(url)
  th <- tryCatch(tm_player_transfer_history(player_urls = url), error=function(e) NULL)
  if (!is.null(th) && nrow(th) > 0) {
    th <- th %>% arrange(transfer_date)
    trs[[length(trs)+1]] <- tibble(player_id=pid, player_name=th$player_name, season=th$season, transfer_date=th$transfer_date,
      from_club_name=th$team_from, to_club_name=th$team_to, from_country=th$country_from, to_country=th$country_to,
      is_loan=grepl("loan", tolower(th$transfer_type %||% "")), fee_eur=suppressWarnings(as.numeric(th$transfer_value)),
      market_value_eur=suppressWarnings(as.numeric(th$market_value)), seq=seq_len(nrow(th)))
  }
  h <- scrape_honours(url)
  if (length(h)) {
    m <- str_match(h, "^(\\d+)x\\s+(.+)$")
    tro[[length(tro)+1]] <- tibble(scope="player", player_id=pid, trophy=trimws(m[,3]), count=as.integer(m[,2]))
  }
  if (i %% 50 == 0) message("  ", i, "/", nrow(pool))
}
write_csv(bind_rows(trs), "scripts/tm_out/tm_transfers_full.csv")
write_csv(bind_rows(tro) %>% filter(!is.na(player_id), !is.na(trophy)) %>% distinct(player_id, trophy, .keep_all=TRUE), "scripts/tm_out/tm_trophies.csv")
message("DONE — transfers: ", length(trs), " players, trophies rows: ", nrow(bind_rows(tro)))
