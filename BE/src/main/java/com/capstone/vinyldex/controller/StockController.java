package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.stock.StockService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Borsa di Wall Street: listino, grafici, portafoglio e ordini. */
@Tag(name = Tags.BORSA, description = Tags.BORSA_INFO)
@RestController
@RequestMapping("/api/stocks")
public class StockController {

    private final StockService stocks;

    public StockController(StockService stocks) {
        this.stocks = stocks;
    }

    public record TradeRequest(String symbol, String side, int shares) {
    }

    @Operation(summary = "Listino e portafoglio")
    @GetMapping
    public Map<String, Object> view(@CurrentUser UserPrincipal principal) {
        return stocks.view(principal.getId());
    }

    @Operation(summary = "Grafico di un titolo")
    @GetMapping("/{symbol}/history")
    public Map<String, Object> history(@PathVariable String symbol, @RequestParam(defaultValue = "1h") String range) {
        return stocks.history(symbol.toUpperCase(), range);
    }

    @Operation(summary = "Compra o vende azioni")
    @PostMapping("/trade")
    public Map<String, Object> trade(@CurrentUser UserPrincipal principal, @RequestBody TradeRequest request) {
        return stocks.trade(principal.getId(), request.symbol() == null ? "" : request.symbol().toUpperCase(), request.side(), request.shares());
    }
}
