-- Eventi a orario creati dall'admin dal pannello (oltre a quelli fissi del codice).
CREATE TABLE hotel_custom_events (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    title        varchar(60)  NOT NULL,
    game         varchar(20)  NOT NULL,
    sum_scores   boolean      NOT NULL DEFAULT false,
    day_of_week  integer      CHECK (day_of_week BETWEEN 1 AND 7),
    start_time   time         NOT NULL,
    minutes      integer      NOT NULL CHECK (minutes BETWEEN 5 AND 240),
    room         varchar(60)  NOT NULL DEFAULT 'Hotel',
    rules        varchar(200) NOT NULL DEFAULT '',
    prize1       integer      NOT NULL DEFAULT 300 CHECK (prize1 >= 0),
    prize2       integer      NOT NULL DEFAULT 150 CHECK (prize2 >= 0),
    prize3       integer      NOT NULL DEFAULT 75 CHECK (prize3 >= 0),
    active       boolean      NOT NULL DEFAULT true,
    created_at   timestamptz  NOT NULL DEFAULT now()
);
