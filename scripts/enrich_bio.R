# Enrich tm_players with photos + richer bio via tm_player_bio (picture_url, birthplace, max value).
suppressMessages({ library(worldfootballR); library(dplyr); library(readr) })
urls <- read_csv("scripts/tm_out/tm_players.csv", show_col_types=FALSE)$tm_url
message("bio for ", length(urls), " players …")
b <- tm_player_bio(player_urls = urls)
out <- tibble(
  player_id = b$player_id,
  photo_url = b$picture_url,
  birth_place = b$place_of_birth,
  current_market_value_eur = suppressWarnings(as.numeric(b$player_valuation)),
  max_market_value_eur = suppressWarnings(as.numeric(b$max_player_valuation))
) %>% filter(!is.na(player_id)) %>% distinct(player_id, .keep_all=TRUE)
write_csv(out, "scripts/tm_out/tm_players_bio.csv")
message("DONE bio -> ", nrow(out), " rows")
