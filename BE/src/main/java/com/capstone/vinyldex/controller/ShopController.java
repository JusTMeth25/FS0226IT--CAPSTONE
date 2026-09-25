package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.CardBuybackService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Negozio dell'hotel: oltre ai mobili, ricompra le carte che hanno un prezzo di mercato. */
@RestController
@RequestMapping("/api/shop")
public class ShopController {

    /** cardId e' il code pubblico della carta. */
    public record SellRequest(@NotBlank(message = "card_not_found") String cardId,
                              @NotNull(message = "invalid_quantity") @Min(value = 1, message = "invalid_quantity")
                              @Max(value = 99, message = "invalid_quantity") Integer quantity) {
    }

    private final CardBuybackService buybackService;

    public ShopController(CardBuybackService buybackService) {
        this.buybackService = buybackService;
    }

    /** Le carte che il negozio compra, con quanto offre per ognuna e i gold ancora ricavabili oggi. */
    @GetMapping("/buyback")
    public CardBuybackService.Quotes quotes(@CurrentUser UserPrincipal principal) {
        return buybackService.quotes(principal.getId());
    }

    @PostMapping("/buyback")
    public CardBuybackService.Sale sell(@CurrentUser UserPrincipal principal, @Valid @RequestBody SellRequest request) {
        return buybackService.sell(principal.getId(), request.cardId(), request.quantity());
    }
}
