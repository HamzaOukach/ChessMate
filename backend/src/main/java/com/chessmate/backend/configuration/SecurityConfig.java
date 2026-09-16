package com.chessmate.backend.configuration;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.chessmate.backend.filter.JwtFilter;
import com.chessmate.backend.service.CustomUserDetailsService;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;
    private final JwtUtils jwtUtils;
    private final JwtFilter jwtFilter;

    public SecurityConfig(CustomUserDetailsService s, JwtUtils u, JwtFilter f) {
        this.customUserDetailsService = s;
        this.jwtUtils = u;
        this.jwtFilter = f;
    }

    /**
     * CRITICAL: Prevent Spring Boot from auto-registering JwtFilter as a
     * standalone Servlet filter. It must ONLY live inside the Spring Security
     * filter chain (addFilterBefore). Without this, the filter runs twice and
     * causes unpredictable 403 errors on permitAll() endpoints.
     */
    @Bean
    public FilterRegistrationBean<JwtFilter> jwtFilterRegistration() {
        FilterRegistrationBean<JwtFilter> registration = new FilterRegistrationBean<>(jwtFilter);
        registration.setEnabled(false); // Disable auto-registration as servlet filter
        return registration;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Use setAllowedOriginPatterns("*") — compatible with allowCredentials(true)
        // This matches ANY origin including all localhost ports (3000, 5173, 8080, etc.)
        configuration.setAllowedOriginPatterns(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // Cache preflight for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        // OPTIONS preflight must always pass
                        .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                        // Public auth endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        // Public game endpoints
                        .requestMatchers("/api/chess/**").permitAll()
                        .requestMatchers("/api/stats/**").permitAll()
                        // Lichess API endpoints
                        .requestMatchers("/api/parties/**").permitAll()
                        .requestMatchers("/api/partie/**").permitAll()
                        // Friends & Chat: completely public — controllers handle auth internally
                        .requestMatchers("/api/friends/**").permitAll()
                        .requestMatchers("/api/chat/**").permitAll()
                        // Online parties
                        .requestMatchers("/api/online-parties/**").permitAll()
                        // Parties jouées (saved local games — no /api/ prefix)
                        .requestMatchers("/parties-jouees/**").permitAll()
                        // Parties dataset (Lichess import — no /api/ prefix)
                        .requestMatchers("/parties/**").permitAll()
                        // Cheat detection
                        .requestMatchers("/api/cheat/**").permitAll()
                        // ML analysis
                        .requestMatchers("/api/ml/**").permitAll()
                        // Swagger / OpenAPI
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui/index.html").permitAll()
                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )
                // Use the Spring-managed JwtFilter bean (not a new instance)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(HttpSecurity http) throws Exception {
        AuthenticationManagerBuilder authenticationManagerBuilder = http
                .getSharedObject(AuthenticationManagerBuilder.class);
        authenticationManagerBuilder.userDetailsService(customUserDetailsService)
                .passwordEncoder(passwordEncoder());
        return authenticationManagerBuilder.build();
    }
}