package com.capstone.vinyldex.security;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Legge il Bearer token e popola il SecurityContext.
 *
 * Un token assente o non valido non interrompe la catena: la richiesta prosegue senza
 * autenticazione e sono le regole di SecurityConfig a decidere se respingerla. Serve agli
 * endpoint pubblici che mostrano dati in piu' all'utente loggato, cioe' l'equivalente di
 * optionalCurrentUser nel vecchio backend Node.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {

            JwtService.Access access = jwtService.extractAccess(header.substring(BEARER_PREFIX.length()).trim());
            if (access != null) {
                Optional<User> user = userRepository.findById(access.userId());
                // Un utente bannato o cancellato non viene autenticato: il token da solo non basta. Nemmeno
                // un token emesso prima dell'ultimo cambio della password.
                if (user.isPresent() && !user.get().isBanned() && user.get().acceptsTokenIssuedAt(access.issuedAt())) {
                    UserPrincipal principal = new UserPrincipal(user.get());
                    var authentication = new UsernamePasswordAuthenticationToken(
                            principal, null, principal.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
