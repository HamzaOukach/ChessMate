package com.chessmate.backend.filter;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.chessmate.backend.configuration.JwtUtils;
import com.chessmate.backend.service.CustomUserDetailsService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component // Spring bean — auto-registration disabled by FilterRegistrationBean in SecurityConfig
public class JwtFilter extends OncePerRequestFilter {
    // Champs finaux pour l'injection de dépendances
    private final CustomUserDetailsService customUserDetailsService;
    private final JwtUtils jwtUtils;

    // Constructeur explicit pour l'injection
    public JwtFilter(CustomUserDetailsService c, JwtUtils u)
    {
        super();
        this.customUserDetailsService = c;
        this.jwtUtils = u;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        // Skip JWT validation for OPTIONS requests (CORS preflight)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }
        
        final String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String jwt = authHeader.substring(7);
            try {
                String username = jwtUtils.extractUsername(jwt);
                if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserDetails userDetails = customUserDetailsService.loadUserByUsername(username);
                    if (jwtUtils.validateToken(jwt, userDetails)) {
                        UsernamePasswordAuthenticationToken authenticationToken =
                                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                        authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authenticationToken);
                    } else {
                        // Token invalid — clear context so permitAll() routes still work
                        SecurityContextHolder.clearContext();
                    }
                }
            } catch (Exception e) {
                // Token expired, malformed, user deleted, etc.
                // IMPORTANT: clear context so Spring Security treats this as anonymous
                // Without this, ExceptionTranslationFilter converts it to a 403 even on permitAll() routes
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }
}
