"""Authoring pipeline tests use synthetic images only inside isolated temporary directories."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('stage_importer', REPO / 'tools/import_legislature_stage.py')


class ImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.tool = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(self.tool)
        self.tool.ROOT = self.root
        self.tool.SOURCE = self.root / 'assets/source-art/phase4/stages/立法院議場對決舞台.png'
        self.tool.TARGET = self.root / 'public/art/stages/legislature'

    def image(self, name='input.png', size=(960, 540)):
        source = self.root / name
        Image.new('RGBA', size, (210, 145, 80, 240)).save(source)
        return source

    def test_missing_or_invalid_art_never_enables_or_creates_a_stage(self):
        with self.assertRaises(ValueError):
            self.tool.build(self.root / 'absent.png')
        with self.assertRaises(ValueError):
            self.tool.build(self.image(size=(512, 512)))
        self.assertFalse((self.root / 'public/stage-assets.js').exists())
        self.assertFalse(self.tool.SOURCE.exists())

    def test_original_is_preserved_and_derivatives_are_proportional_and_background_only(self):
        source = self.image()
        raw = source.read_bytes()
        self.tool.build(source)
        self.assertEqual(self.tool.SOURCE.read_bytes(), raw)
        manifest = json.loads((self.tool.TARGET / 'manifest.json').read_text())
        self.assertEqual(manifest['source']['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(manifest['geometry']['spawns'], [274, 686])
        for role, asset in manifest['assets'].items():
            data = (self.root / 'public' / asset['path']).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), asset['sha256'])
            with Image.open(self.root / 'public' / asset['path']) as image:
                self.assertAlmostEqual(image.width / image.height, 16 / 9)
                if role == 'preview':
                    self.assertEqual(image.size, (640, 360))
                if role == 'background':
                    self.assertEqual(image.getchannel('A').getextrema(), (240, 240))
                if role == 'combat':
                    self.assertEqual(image.mode, 'RGB')
        self.assertIn('"ready": true', (self.root / 'public/stage-assets.js').read_text())

    def test_rebuild_is_repeatable_and_different_original_cannot_overwrite_source(self):
        source = self.image()
        self.tool.build(source)
        before = (self.tool.TARGET / 'manifest.json').read_bytes()
        self.tool.build(source)
        self.assertEqual(before, (self.tool.TARGET / 'manifest.json').read_bytes())
        other = self.root / 'other.png'
        Image.new('RGB', (960, 540), 'blue').save(other)
        with self.assertRaises(ValueError):
            self.tool.build(other)
        self.assertEqual(self.tool.SOURCE.read_bytes(), source.read_bytes())


if __name__ == '__main__':
    unittest.main()
