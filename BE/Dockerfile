# Backend VinylDex (Spring Boot, Java 25): si compila nel primo stadio, gira col solo JRE nel secondo.
# Va bene sia su x86 sia su ARM (il server Oracle Ampere).

FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
# Da Windows mvnw puo' arrivare con i fine riga CRLF: sh non lo eseguirebbe.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
# I test parlano col database: si lanciano in sviluppo, non nella build dell'immagine.
RUN ./mvnw -q -B -DskipTests package && cp target/vinyldex-*.jar /src/app.jar

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 10001 vinyldex
COPY --from=build /src/app.jar app.jar
USER vinyldex
EXPOSE 4000
# La JVM prende al massimo il 60% della memoria del container (il catalogo carte sta in memoria).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
