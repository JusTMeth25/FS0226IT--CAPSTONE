package com.capstone.vinyldex.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Email del sito (per ora il reset della password), via SMTP di Brevo.
 *
 * Si spediscono in un thread a parte: la risposta all'utente non aspetta il server SMTP, e cosi'
 * non si capisce dai tempi se un'email e' registrata. Senza MAIL_HOST (sviluppo locale) non parte
 * niente: il testo finisce nel log, link compreso, per provare il flusso lo stesso.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String host;
    private final String from;
    private final String fromName;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${spring.mail.host:}") String host,
                       @Value("${vinyldex.mail.from:}") String from,
                       @Value("${vinyldex.mail.from-name:VinylDex}") String fromName) {
        this.sender = sender;
        this.host = host.trim();
        this.from = from.trim();
        this.fromName = fromName.trim();
    }

    public boolean configured() {
        return !host.isEmpty() && !from.isEmpty() && sender.getIfAvailable() != null;
    }

    /** Spedisce l'email in un thread a parte; gli errori finiscono nel log, mai all'utente. */
    public void send(String to, String subject, String text, String html) {
        if (!configured()) {
            log.warn("Email non configurata (MAIL_HOST/MAIL_FROM): a {} sarebbe arrivato \"{}\":\n{}", to, subject, text);
            return;
        }
        Thread.startVirtualThread(() -> {
            try {
                JavaMailSender mail = sender.getObject();
                MimeMessage message = mail.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setFrom(from, fromName);
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(text, html);
                mail.send(message);
            } catch (Exception e) {
                log.error("Email a {} non spedita: {}", to, e.getMessage());
            }
        });
    }
}
