# 🚀 Shap-E Integration Guide

**Date**: 2025-11-28
**Status**: ✅ Code Complete, ⏳ Pending Installation (disk space issue)
**Phase**: Phase 1 - 90% Complete

---

## Executive Summary

✅ **What's Done**:
- Updated plan for LOCAL Shap-E (no API costs!)
- Integrated local Shap-E into `backend/app/services/shap_e.py`
- Added PLY format support to mesh converter
- Created complete integration code

⏳ **What's Needed**:
- Free up disk space (~5GB)
- Install Shap-E package
- Test generation with sample prompts

---

## 💰 Cost Savings: FREE Local Model vs API

| Aspect | Local Shap-E | API (Meshy.ai) |
|--------|-------------|----------------|
| **Cost per object** | **$0.00** ✅ | ~$0.10-0.30 |
| **Monthly cost (1000 objects)** | **$0.00** ✅ | $100-300 |
| **Rate limits** | **None** ✅ | Yes |
| **Privacy** | **100% local** ✅ | Cloud |
| **Customization** | **Full control** ✅ | Limited |

**Total Savings**: **$100-300/month** for moderate usage!

---

## 🎯 Current Status

### Phase 1 Progress: 90% Complete

| Task | Status | Notes |
|------|--------|-------|
| ✅ Routing service | **COMPLETE** | 93% accuracy |
| ✅ Service structure | **COMPLETE** | Singleton pattern |
| ✅ Shap-E integration code | **COMPLETE** | Local models |
| ✅ Mesh converter (PLY support) | **COMPLETE** | PLY→GLB/STEP/DXF |
| ✅ Plan updated | **COMPLETE** | FREE local models! |
| ⏳ Shap-E installation | **BLOCKED** | Disk space: 3.2GB free, need 5GB |
| ⏳ Testing | **PENDING** | Waiting for installation |

---

## 🔧 What Was Implemented

### 1. Updated Plan ([ULTRA_REALISTIC_ANY_OBJECT_PLAN.md](ULTRA_REALISTIC_ANY_OBJECT_PLAN.md))

**Key Changes**:
- ✅ Switched from API to LOCAL models
- ✅ Updated cost analysis: **$0 per generation**
- ✅ Removed API risks (downtime, costs)
- ✅ Updated dependencies for local installation
- ✅ Phase 1 marked as 60% complete → 90% complete

### 2. Shap-E Service ([backend/app/services/shap_e.py](backend/app/services/shap_e.py))

**New Features**:
```python
# Lazy model loading (4GB models downloaded on first use)
def _load_models(self):
    self.transmitter = load_model('transmitter', device=self.device)
    self.shap_e_model = load_model('text300M', device=self.device)
    self.diffusion = diffusion_from_config(load_config('diffusion'))

# Local generation (replaces API call)
async def _call_shap_e_api(self, prompt, guidance_scale, num_steps, frame_size):
    self._load_models()  # Load on first use
    mesh_bytes = await loop.run_in_executor(
        None, self._generate_mesh_sync, prompt, guidance_scale, num_steps
    )
    return mesh_bytes  # Returns PLY format

# Synchronous generation in thread pool
def _generate_mesh_sync(self, prompt, guidance_scale, num_steps):
    latents = sample_latents(...)  # Diffusion sampling
    mesh = decode_latent_mesh(self.transmitter, latent).tri_mesh()
    return ply_bytes
```

**Imports Added**:
```python
try:
    import torch
    from shap_e.diffusion.sample import sample_latents
    from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
    from shap_e.models.download import load_model, load_config
    from shap_e.util.notebooks import decode_latent_mesh
    SHAP_E_AVAILABLE = True
except ImportError:
    SHAP_E_AVAILABLE = False
```

**Device Detection**:
- ✅ Auto-detects GPU (30-60 sec generation) or CPU (2-5 min)
- ✅ Logs device type on startup
- ✅ Gracefully handles missing installation

### 3. Mesh Converter ([backend/app/services/mesh_converter.py](backend/app/services/mesh_converter.py))

**New PLY Support**:
```python
FormatType = Literal["ply", "glb", "step", "dxf", "obj", "stl"]

# Convenience functions for Shap-E output
def ply_to_glb(ply_bytes: bytes) -> bytes:
    """Convert PLY to GLB format (for Shap-E output)."""
    return convert_mesh(ply_bytes, "ply", "glb")

def ply_to_step(ply_bytes: bytes) -> bytes:
    """Convert PLY to STEP format (for CAD software)."""
    return convert_mesh(ply_bytes, "ply", "step")

def ply_to_dxf(ply_bytes: bytes) -> bytes:
    """Convert PLY to DXF format (for AutoCAD)."""
    return convert_mesh(ply_bytes, "ply", "dxf")
```

---

## 🚧 Disk Space Issue

### Current Situation

```bash
$ df -h
Filesystem      Size  Used  Avail  Use%
/dev/nvme0n1p6  50G   44G   3.2G   94%
```

**Problem**: Only 3.2GB free, need ~5GB for:
- PyTorch with CUDA: ~2.5GB
- Shap-E models (auto-download): ~4GB
- Other dependencies: ~0.5GB

**Total needed**: ~5-7GB free space

### Solutions

**Option 1: Free Up Disk Space** (Recommended)
```bash
# Clean package cache
sudo apt clean
sudo apt autoclean

# Clean pip cache
pip cache purge

# Clean Docker (if installed)
docker system prune -a

# Find large files
du -h ~ | sort -rh | head -20

# After freeing space, install:
cd docs/useful_projects/shap-e-main
pip install --break-system-packages -e .
```

**Option 2: Install PyTorch CPU-Only** (Smaller, slower)
```bash
# Install CPU-only PyTorch first (~1GB smaller)
pip install --break-system-packages torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Then install Shap-E
cd docs/useful_projects/shap-e-main
pip install --break-system-packages -e .
```

**Option 3: External Storage**
- Mount external drive with more space
- Move some existing data to external storage
- Retry installation

---

## 📝 Installation Steps (When Ready)

### Step 1: Free Up Space

See solutions above. Aim for **7GB+ free space**.

### Step 2: Install Shap-E

```bash
# Navigate to Shap-E directory
cd ~/CADLift/docs/useful_projects/shap-e-main

# Install in editable mode
pip install --break-system-packages -e .

# This will:
# - Install PyTorch (~2.5GB with CUDA)
# - Install CLIP from OpenAI
# - Install all Shap-E dependencies
```

**Note**: Models (~4GB) auto-download on **first generation**, not during installation.

### Step 3: Verify Installation

```python
# Test in Python
python3
>>> import torch
>>> import shap_e
>>> from shap_e.models.download import load_model
>>> print("Shap-E installed successfully!")
>>> exit()
```

### Step 4: Test Generation

```bash
# Run backend
cd ~/CADLift/backend
python3 -m app.main

# In another terminal, test generation:
python3 -c "
from app.services.shap_e import get_shap_e_service
import asyncio

async def test():
    service = get_shap_e_service()
    print(f'Service enabled: {service.enabled}')
    print(f'Device: {service.device}')

    # This will download models on first run (~4GB)
    print('Generating test object...')
    ply_bytes = await service.generate_from_text('a simple cube')
    print(f'Generated: {len(ply_bytes)} bytes')

asyncio.run(test())
"
```

### Step 5: Run Integration Tests

```bash
cd ~/CADLift/backend
python3 tests/test_phase1_ai_integration.py
```

Expected output:
```
✅ Test 1: Routing service initialization...
✅ Test 2: Engineering object routing (3/3)
✅ Test 3: Organic object routing (3/3)
✅ Test 4: Architectural object routing (1/2)
✅ Test 5: Shap-E service structure
✅ Test 6: Mesh converter structure
✅ Test 7: AI pipeline structure
✅ Test 8: Routing confidence scores (3/3)
✅ Test 9: Dimension extraction (3/3)
✅ Test 10: Routing override mechanism

🎉 All 10 tests passed!
```

---

## 🎨 How It Works

### Complete Generation Flow

```
User Prompt: "A realistic dragon statue"
           ↓
┌──────────────────────────────────────┐
│  Routing Service                      │
│  - Classifies prompt as "ai"          │
│  - Confidence: 0.90                   │
│  - Routes to AI pipeline              │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│  AI Pipeline                          │
│  - Calls Shap-E service               │
│  - Optimizes prompt                   │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│  Shap-E Service (LOCAL)               │
│  1. Load models (first use only)      │
│     - transmitter (encoder/decoder)   │
│     - text300M (diffusion model)      │
│     - diffusion config                │
│                                       │
│  2. Generate latent                   │
│     - Diffusion sampling (64 steps)   │
│     - Guidance scale: 15.0            │
│                                       │
│  3. Decode to mesh                    │
│     - Vertices + faces                │
│                                       │
│  4. Export PLY                        │
│     - Returns PLY bytes               │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│  Mesh Converter                       │
│  - PLY → STEP (CAD software)          │
│  - PLY → DXF (AutoCAD)                │
│  - PLY → GLB (Web 3D)                 │
└──────────────────────────────────────┘
           ↓
        User receives:
        - dragon.step
        - dragon.dxf
        - dragon.glb
```

---

## 🧪 Testing Plan

### Unit Tests
```bash
# Test routing
python3 -c "
from app.services.routing import get_routing_service
routing = get_routing_service()
decision = routing.route('A dragon statue')
assert decision.pipeline == 'ai'
print('✅ Routing works')
"

# Test Shap-E service structure
python3 -c "
from app.services.shap_e import get_shap_e_service
service = get_shap_e_service()
print(f'Enabled: {service.enabled}')
print('✅ Service structure works')
"

# Test mesh converter
python3 -c "
from app.services.mesh_converter import get_mesh_converter
converter = get_mesh_converter()
print('✅ Converter initialized')
"
```

### Integration Test (After Installation)
```bash
# Full end-to-end test
python3 backend/tests/test_phase1_ai_integration.py
```

---

## 📊 Performance Expectations

### Generation Time

| Hardware | Time per Object | Notes |
|----------|----------------|-------|
| **NVIDIA RTX 3080** | 30-45 sec | Ideal |
| **NVIDIA GTX 1060** | 45-90 sec | Good |
| **CPU (16 cores)** | 2-4 min | Acceptable |
| **CPU (4 cores)** | 3-5 min | Slow but works |

### Memory Usage

| Component | RAM | VRAM (GPU) |
|-----------|-----|------------|
| Models loaded | 2-3GB | 4-6GB |
| During generation | +1-2GB | +2-3GB |
| **Total** | **4-5GB** | **6-9GB** |

**Minimum Requirements**:
- RAM: 8GB (16GB recommended)
- VRAM: Not required (CPU works), but 6GB+ for GPU

---

## 🎯 Next Steps

### Immediate (Once Installed)
1. ✅ Free up 7GB disk space
2. ✅ Install Shap-E package
3. ✅ Run integration tests (10/10 should pass)
4. ✅ Generate 10 test objects:
   - "a simple cube"
   - "a dragon statue"
   - "a coffee mug"
   - "a human face"
   - "a tree"
   - "a cat sitting"
   - "a car"
   - "a chair"
   - "a vase"
   - "a bottle"
5. ✅ Measure generation time (GPU vs CPU)
6. ✅ Test format conversions (PLY→STEP, PLY→DXF)

### Phase 1 Completion (This Week)
7. ✅ Create Phase 1 completion report
8. ✅ Update documentation with examples
9. ✅ Commit to git with message:
   ```
   feat: Add local Shap-E integration for AI-based 3D generation

   - Integrated OpenAI Shap-E models (local, FREE)
   - Added PLY format support to mesh converter
   - Updated routing service (93% accuracy)
   - Zero API costs, unlimited generations
   - Phase 1: 100% complete

   🤖 Generated with Claude Code
   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

### Phase 2 (Next Week)
10. Start Image-to-3D with Shap-E `image300M` model
11. Add TripoSR for enhanced image-to-3D

---

## 💡 Benefits of Local Shap-E

### 1. Cost Savings ✅
- **$0 per generation** (vs $0.10-0.30 with APIs)
- **$0 monthly** (vs $100-300 with APIs)
- **Unlimited use** (no rate limits)

### 2. Privacy ✅
- All data stays on your server
- No cloud uploads
- No external API calls
- Full GDPR compliance

### 3. Control ✅
- No API downtime
- No rate limiting
- No vendor lock-in
- Can fine-tune models

### 4. Performance ✅
- Fast with GPU (30-60 sec)
- Works on CPU (2-5 min)
- No network latency
- Batch generation possible

---

## 🚀 Summary

**Phase 1 Status**: **90% Complete** 🎉

✅ **Completed**:
- Local Shap-E integration code
- PLY format support
- Updated plan and documentation
- Routing service (93% accuracy)

⏳ **Remaining**:
- Free up disk space (~5GB)
- Install Shap-E package
- Test generation

**Once installed, Phase 1 will be 100% complete!**

---

## 📞 Troubleshooting

### Issue: "No module named 'shap_e'"
**Solution**: Shap-E not installed yet. See [Installation Steps](#installation-steps-when-ready).

### Issue: "CUDA out of memory"
**Solution**:
```python
# Reduce batch size or use CPU
self.device = torch.device('cpu')
```

### Issue: Models downloading slowly
**Solution**: First-time download is ~4GB. Be patient or use wired connection.

### Issue: Generation too slow on CPU
**Solution**:
- Use GPU if available
- Reduce `num_steps` from 64 to 32 (faster, lower quality)
- Enable caching for common objects

---

**Date**: 2025-11-28
**Author**: Claude Code
**Status**: Phase 1 - 90% Complete, Ready for Installation
