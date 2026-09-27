-- Codice aspetto piu' lungo: con capo firmato, orologio, veicolo, collana e orecchini arriva a
-- una cinquantina di caratteri ("s1.h2.hc7.sh11.p1.t2.f0.a0.b1.o12.w11.r9.n3.e6").
ALTER TABLE users ALTER COLUMN hotel_look TYPE varchar(64);
