package com.capstone.vinyldex.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

/**
 * Client HTTP per le API esterne di carte.
 * I timeout sono espliciti: un'API lenta non deve tenere occupato un thread all'infinito.
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient importRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));

        // Non tutte le fonti dichiarano application/json: tcgcsv.com risponde "text/json" e il
        // convertitore predefinito rifiuterebbe il corpo. Qui si accetta qualsiasi Content-Type
        // e si prova comunque a leggerlo come JSON: chiamiamo solo endpoint JSON, e una risposta
        // davvero diversa fallirebbe comunque in parsing facendo scattare il fallback demo.
        JacksonJsonHttpMessageConverter jsonConverter = new JacksonJsonHttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(List.of(MediaType.ALL));

        return RestClient.builder()
                .requestFactory(factory)
                .messageConverters(converters -> {
                    converters.clear();
                    converters.add(jsonConverter);
                })
                .defaultHeader("User-Agent", "VinylDex/1.0 (capstone project)")
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
