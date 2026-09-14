package com.capstone.vinyldex.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

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

        return RestClient.builder()
                .requestFactory(factory)
                .defaultHeader("User-Agent", "VinylDex/1.0 (capstone project)")
                .build();
    }
}
