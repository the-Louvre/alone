package com.unispeaking.controller;

import com.unispeaking.common.response.ApiResponse;
import com.unispeaking.domain.dto.agent.AgentModels.*;
import com.unispeaking.service.agent.AgentWorkspaceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agent-workspace")
public class AgentWorkspaceController {
    private final AgentWorkspaceService service;
    public AgentWorkspaceController(AgentWorkspaceService service) { this.service=service; }
    @GetMapping("/agents") public ApiResponse<?> agents() { return ApiResponse.success(service.agents()); }
    @PostMapping("/agents") public ApiResponse<?> create(@Valid @RequestBody Config input) { return ApiResponse.success(service.save(null,input)); }
    @PostMapping("/presets/{key}") public ApiResponse<?> savePreset(@PathVariable String key,@Valid @RequestBody PresetSave input) { return ApiResponse.success(service.savePreset(key,input)); }
    @PutMapping("/agents/{id}") public ApiResponse<?> update(@PathVariable String id,@Valid @RequestBody Config input) { return ApiResponse.success(service.save(id,input)); }
    @PostMapping("/generate") public ApiResponse<?> generate(@Valid @RequestBody Generate input) { return ApiResponse.success(service.generate(input)); }
    @PostMapping("/agents/{id}/open") public ApiResponse<?> openAgent(@PathVariable String id) { return ApiResponse.success(service.openAgent(id)); }
    @PostMapping("/threads") public ApiResponse<?> createThread(@Valid @RequestBody ThreadStart input) { return ApiResponse.success(service.createThread(input.config(),input.requestId())); }
    @GetMapping("/threads") public ApiResponse<?> threads(@RequestParam(required=false) String agentId,@RequestParam(defaultValue="0") int offset,@RequestParam(defaultValue="false") boolean deleted,@RequestParam(defaultValue="") String q) { return ApiResponse.success(q.isBlank()?service.threadHistory(agentId,offset,deleted):service.threadHistory(agentId,offset,deleted,q)); }
    @GetMapping("/threads/{id}") public ApiResponse<?> thread(@PathVariable String id) { return ApiResponse.success(service.threadDetail(id)); }
    @PostMapping("/threads/{id}/open") public ApiResponse<?> openThread(@PathVariable String id) { return ApiResponse.success(service.openThread(id)); }
    @PostMapping("/threads/{id}/messages") public ApiResponse<?> threadTurn(@PathVariable String id,@Valid @RequestBody Turn input) { return ApiResponse.success(service.threadTurn(id,input)); }
    @PostMapping("/threads/{id}/end") public ApiResponse<?> endThread(@PathVariable String id) { return ApiResponse.success(service.finishThread(id)); }
    @DeleteMapping("/threads/{id}") public ApiResponse<?> deleteThread(@PathVariable String id) { return ApiResponse.success(service.deleteThread(id)); }
    @PostMapping("/threads/{id}/restore") public ApiResponse<?> restoreThread(@PathVariable String id) { return ApiResponse.success(service.restoreThread(id)); }
    @GetMapping("/legacy-conversations") public ApiResponse<?> legacy(@RequestParam(defaultValue="false") boolean deleted,@RequestParam(defaultValue="") String q) { return ApiResponse.success(q.isBlank()?service.legacyHistory(deleted):service.legacyHistory(deleted,q)); }
    @DeleteMapping("/legacy-conversations/{id}") public ApiResponse<?> deleteLegacy(@PathVariable String id) { return ApiResponse.success(service.changeLegacyTrash(id,true)); }
    @PostMapping("/legacy-conversations/{id}/restore") public ApiResponse<?> restoreLegacy(@PathVariable String id) { return ApiResponse.success(service.changeLegacyTrash(id,false)); }
    @PostMapping("/conversations/{id}/transcripts") public ApiResponse<?> transcript(@PathVariable String id,@Valid @RequestBody Transcript input) { return ApiResponse.success(service.transcript(id,input)); }
    @PostMapping("/conversations") public ApiResponse<?> start(@Valid @RequestBody Start input) { return ApiResponse.success(service.start(input.config())); }
    @GetMapping("/conversations") public ApiResponse<?> history() { return ApiResponse.success(service.history()); }
    @GetMapping("/conversations/{id}") public ApiResponse<?> detail(@PathVariable String id) { return ApiResponse.success(service.detail(id)); }
    @PostMapping("/conversations/{id}/messages") public ApiResponse<?> turn(@PathVariable String id,@Valid @RequestBody Turn input) { return ApiResponse.success(service.turn(id,input)); }
    @PostMapping("/conversations/{id}/end") public ApiResponse<?> end(@PathVariable String id) { return ApiResponse.success(service.finish(id)); }
    @PostMapping("/threads/{id}/hints") public ApiResponse<?> hint(@PathVariable String id) { return ApiResponse.success(service.hint(id)); }
    @PostMapping("/conversations/{id}/messages/{no}/translation") public ApiResponse<?> translate(@PathVariable String id,@PathVariable int no) { return ApiResponse.success(service.translateMessage(id,no)); }
    @PostMapping(value="/conversations/{id}/messages/{no}/speech",produces="audio/wav") public ResponseEntity<byte[]> speech(@PathVariable String id,@PathVariable int no) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType("audio/wav")).body(service.readMessage(id,no));
    }
    @PostMapping("/conversations/{id}/messages/{no}/suggestions") public ApiResponse<?> suggest(@PathVariable String id,@PathVariable int no) { return ApiResponse.success(service.suggestions(id,no)); }
    @PostMapping("/conversations/{id}/learning") public ApiResponse<?> collect(@PathVariable String id,@Valid @RequestBody Collect input) { return ApiResponse.success(service.collect(id,input)); }
    @GetMapping("/learning") public ApiResponse<?> learning() { return ApiResponse.success(service.learning()); }
    @PostMapping("/learning/{id}/attempts") public ApiResponse<?> practice(@PathVariable String id,@Valid @RequestBody Attempt input) { return ApiResponse.success(service.practice(id,input)); }
    @GetMapping("/attempts") public ApiResponse<?> attempts() { return ApiResponse.success(service.attempts()); }
}
