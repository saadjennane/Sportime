# Robust bio enrichment: batches + tryCatch so one bad page doesn't kill the run.
suppressMessages({ library(worldfootballR); library(dplyr); library(readr) })
urls <- read_csv("scripts/tm_out/tm_players.csv", show_col_types=FALSE)$tm_url
urls <- unique(urls[!is.na(urls)])
message("bio for ", length(urls), " players, in batches …")
getcol <- function(df, nm) if (nm %in% names(df)) df[[nm]] else rep(NA, nrow(df))
acc <- list(); B <- 25
for (i in seq(1, length(urls), by=B)) {
  batch <- urls[i:min(i+B-1, length(urls))]
  b <- tryCatch(tm_player_bio(player_urls=batch), error=function(e) NULL)
  if (is.null(b) || nrow(b)==0) {            # fall back per-player
    for (u in batch) {
      bb <- tryCatch(tm_player_bio(player_urls=u), error=function(e) NULL)
      if (!is.null(bb) && nrow(bb)) acc[[length(acc)+1]] <- bb
    }
  } else acc[[length(acc)+1]] <- b
  if (i %% (B*4) == 1) message("  ", min(i+B-1,length(urls)), "/", length(urls))
}
bio <- bind_rows(acc)
out <- tibble(
  player_id = getcol(bio, "player_id"),
  photo_url = getcol(bio, "picture_url"),
  birth_place = getcol(bio, "place_of_birth"),
  current_market_value_eur = suppressWarnings(as.numeric(getcol(bio, "player_valuation"))),
  max_market_value_eur = suppressWarnings(as.numeric(getcol(bio, "max_player_valuation")))
) %>% filter(!is.na(player_id)) %>% distinct(player_id, .keep_all=TRUE)
write_csv(out, "scripts/tm_out/tm_players_bio.csv")
message("DONE bio -> ", nrow(out), " rows, ", sum(!is.na(out$photo_url)), " photos")
