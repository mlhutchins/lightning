## Replicate WWLLN file generation to perform local end to end tests of the
# data and map pipelines

if (!require(lubridate)) {
    install.packages("lubridate")
}

#' Generate Set of New Strokes
#' 
#' Produce a dataframe with typical WWLLN information
#' 
#' @export
#' @param n Number strokes
newStrokes <- function(n = 1000) {

    timeRange <- 3600
    
    ## Replicate chimneys
    lat <- rnorm(n, 0, 35)
    lon <- c(rnorm(floor(n/2), 10, 35),
             rnorm(floor(n/4), -80, 25),
             rnorm(floor(n/4), 120, 40))
    
    ## Cap latitude and wrap longitude (as needed)
    lat[lat < -89.99] <- -89.99
    lat[lat > 89.99] <- 89.99
    lon <- ((lon + 180) %% 360) - 180
    
    currentTime <- as.numeric(now())
    
    times <- sample(seq(currentTime - timeRange, currentTime), n, replace = TRUE)


}
