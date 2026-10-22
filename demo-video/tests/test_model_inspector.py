import importlib.util
import io
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('inspector', Path(__file__).parents[1] / 'scripts/inspect-model.py')
inspector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inspector)


class StaticInspectionTests(unittest.TestCase):
    def test_rejects_executable_global(self):
        # Never use pickle.loads to test malicious input.
        with self.assertRaisesRegex(ValueError, 'Unsupported opcode: GLOBAL'):
            inspector.read_literals(io.BytesIO(b'\x80\x02cos\nsystem\n)R.'))

    def test_rejects_unknown_constructor(self):
        with self.assertRaises(ValueError):
            inspector.read_literals(io.BytesIO(b'\x80\x02N)R.'))

    def test_text_stays_literal(self):
        text = b'__import__("os").system("false")'
        value = inspector.read_literals(io.BytesIO(b'\x80\x02X' + len(text).to_bytes(4, 'little') + text + b'.'))
        self.assertEqual(value, text.decode())

    def test_rejects_persistent_storage_loading(self):
        with self.assertRaisesRegex(ValueError, 'Unsupported opcode: BINPERSID'):
            inspector.read_literals(io.BytesIO(b'\x80\x02NQ.'))
