package com.unispeaking.controller;

import com.unispeaking.common.response.ApiResponse;
import com.unispeaking.domain.dto.agent.AgentModels.*;
import com.unispeaking.service.agent.AgentWorkspaceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agent-workspace")
public class AgentWorkspaceController {
    private final AgentWorkspaceService service;
    public AgentWorkspaceController(AgentWorkspaceService service) { this.service=service; }
    @GetMapping("/agents") public ApiResponse<?> agents() { return ApiResponse.success(service.agents()); }
    @PostMapping("/agents") public ApiResponse<?> create(@Valid @RequestBody Config input) { return ApiResponse.success(service.save(null,input)); }
    @PutMapping("/agents/{id}") public ApiResponse<?> update(@PathVariable String id,@Valid @RequestBody Config input) { return ApiResponse.success(service.save(id,input)); }
    @PostMapping("/generate") public ApiResponse<?> generate(@Valid @RequestBody Generate input) { return ApiResponse.success(service.generate(input)); }
    @PostMapping("/conversations") public ApiResponse<?> start(@Valid @RequestBody Start input) { return ApiResponse.success(service.start(input.config())); }
    @GetMapping("/conversations") public ApiResponse<?> history() { return ApiResponse.success(service.history()); }
    @GetMapping("/conversations/{id}") public ApiResponse<?> detail(@PathVariable String id) { return ApiResponse.success(service.detail(id)); }
    @PostMapping("/conversations/{id}/messages") public ApiResponse<?> turn(@PathVariable String id,@Valid @RequestBody Turn input) { return ApiResponse.success(service.turn(id,input)); }
    @PostMapping("/conversations/{id}/end") public ApiResponse<?> end(@PathVariable String id) { return ApiResponse.success(service.finish(id)); }
    @PostMapping("/conversations/{id}/messages/{no}/suggestions") public ApiResponse<?> suggest(@PathVariable String id,@PathVariable int no) { return ApiResponse.success(service.suggestions(id,no)); }
    @PostMapping("/conversations/{id}/learning") public ApiResponse<?> collect(@PathVariable String id,@Valid @RequestBody Collect input) { return ApiResponse.success(service.collect(id,input)); }
    @GetMapping("/learning") public ApiResponse<?> learning() { return ApiResponse.success(service.learning()); }
    @PostMapping("/learning/{id}/attempts") public ApiResponse<?> practice(@PathVariable String id,@Valid @RequestBody Attempt input) { return ApiResponse.success(service.practice(id,input)); }
    @GetMapping("/attempts") public ApiResponse<?> attempts() { return ApiResponse.success(service.attempts()); }
}
