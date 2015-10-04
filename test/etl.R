## The A-file to SQLite ETL process

library(RSQLite)

db <- "strokes.db"

## Setup database connection

### Connect to db, create it if is not there
con <- dbConnect(SQLite(), db)

### Check for table, create if needed


