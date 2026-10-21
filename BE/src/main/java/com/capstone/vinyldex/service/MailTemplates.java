package com.capstone.vinyldex.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.nio.charset.StandardCharsets;
import java.time.Year;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Modelli delle email con Thymeleaf, nello stile "Phantom" del sito (Persona 5): fondo nero, fascia
 * magenta, titolo "a ritaglio" con le lettere su tasselli alternati, bottone con l'ombra netta.
 *
 * Ogni email ha due versioni in src/main/resources/templates/mail/: "{nome}.html" (HTML, costruita
 * con tabelle e stili in linea perche' i programmi di posta non leggono fogli di stile ne' clip-path)
 * e "{nome}.txt" (solo testo, per chi non mostra l'HTML). I valori passano dalle espressioni di
 * Thymeleaf, che li proteggono da soli: un nome utente con "<" o "&" non rompe la pagina.
 *
 * Motore proprio, non quello delle viste web: il sito e' React e il backend non serve pagine.
 */
@Component
public class MailTemplates {

    /** Email pronta: oggetto, testo semplice e HTML. */
    public record Rendered(String subject, String text, String html) {
    }

    /** Lettera del titolo a ritaglio: carattere e colori del suo tassello. */
    public record Letter(String ch, String background, String color) {
    }

    /** Tasselli del titolo: {sfondo, lettera}, come i titoli PhantomTitle del sito. */
    private static final String[][] TILES = {
            {"#ffffff", "#07040f"}, {"#07040f", "#ffffff"}, {"#ec4899", "#ffffff"}, {"#ffffff", "#ec4899"}
    };

    private final TemplateEngine engine = new TemplateEngine();
    private final String appUrl;

    public MailTemplates(@Value("${vinyldex.app.url:http://localhost:5173}") String appUrl) {
        this.appUrl = appUrl.replaceAll("/+$", "");
        // I nomi completi decidono il modo: "*.html" e' HTML, "*.txt" solo testo (con [(${...})]).
        engine.addTemplateResolver(resolver(TemplateMode.HTML, "*.html", 1));
        engine.addTemplateResolver(resolver(TemplateMode.TEXT, "*.txt", 2));
    }

    private static ClassLoaderTemplateResolver resolver(TemplateMode mode, String pattern, int order) {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setResolvablePatterns(Set.of(pattern));
        resolver.setTemplateMode(mode);
        resolver.setCharacterEncoding(StandardCharsets.UTF_8.name());
        resolver.setCheckExistence(true);
        resolver.setOrder(order);
        resolver.setCacheable(true);
        return resolver;
    }

    /**
     * Prepara l'email "mail/{name}". Oltre alle variabili date, il modello riceve sempre:
     * subject, title (testo del titolo), ransom (parole del titolo a ritaglio, lettera per lettera), appUrl e year.
     */
    public Rendered render(String name, String subject, String title, Map<String, Object> variables) {
        Map<String, Object> all = new HashMap<>(variables);
        all.put("subject", subject);
        all.put("title", title);
        all.put("ransom", ransom(title));
        all.put("appUrl", appUrl);
        all.put("year", Year.now().getValue());
        Context context = new Context(Locale.ITALIAN, all);
        String html = engine.process("mail/" + name + ".html", context);
        String text = engine.process("mail/" + name + ".txt", context);
        return new Rendered(subject, text, html);
    }

    /**
     * Titolo spezzato in tasselli (maiuscole), una lista per parola: nell'email ogni parola sta su una
     * riga sola, cosi' va a capo solo fra una parola e l'altra. Colori a rotazione su tutto il titolo.
     */
    static List<List<Letter>> ransom(String title) {
        List<List<Letter>> words = new ArrayList<>();
        int visible = 0;
        for (String word : title.toUpperCase(Locale.ITALIAN).trim().split("\\s+")) {
            List<Letter> letters = new ArrayList<>();
            for (int i = 0; i < word.length(); i++) {
                // Bianco e nero alternati, con un tassello magenta ogni cinque e uno bianco-magenta ogni sette.
                String[] tile = visible % 5 == 2 ? TILES[2] : visible % 7 == 4 ? TILES[3] : TILES[visible % 2];
                letters.add(new Letter(String.valueOf(word.charAt(i)), tile[0], tile[1]));
                visible++;
            }
            words.add(letters);
        }
        return words;
    }
}
