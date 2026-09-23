import io
import json
import unittest

from battery_calculator.web import application
from battery_calculator.catalog import example_requests
EXAMPLES = {k:{"request":v} for k,v in example_requests().items()}


class WebTests(unittest.TestCase):
    def call(self, path, method="GET", body=b"", content_type="application/json", length=None):
        response = {}
        def start(status, headers):
            response.update(status=status, headers=dict(headers))
        response["body"] = b"".join(application({"PATH_INFO": path, "REQUEST_METHOD": method,
            "CONTENT_TYPE": content_type, "CONTENT_LENGTH": str(len(body) if length is None else length),
            "wsgi.input": io.BytesIO(body)}, start))
        return response

    def test_three_modes_use_server_owned_leaflets(self):
        for op in EXAMPLES:
            response = self.call("/runtime/api/calculate", "POST", json.dumps(EXAMPLES[op]["request"]).encode())
            self.assertEqual(response["status"], "200 OK")
            data = json.loads(response["body"])
            self.assertFalse(data["demo"])
            self.assertFalse(data["production_ready"])
            self.assertEqual(data["result"]["operation"], op)
            self.assertEqual(data["input_snapshot"]["dataset"]["origin"], "new_shared_dataset")

    def test_assets_routes_and_no_file_traversal(self):
        for path in ("/runtime", "/runtime/", "/runtime/app.js", "/runtime/style.css", "/runtime/health", "/runtime/api/examples"):
            r = self.call(path)
            self.assertEqual(r["status"], "200 OK")
            self.assertEqual(r["headers"]["X-Robots-Tag"], "noindex, nofollow")
        self.assertEqual(self.call("/runtime", "HEAD")["body"], b"")
        self.assertEqual(self.call("/runtime/../core.py")["status"], "404 Not Found")
        self.assertEqual(self.call("/")["status"], "404 Not Found")

    def test_invalid_input_and_payload_limits(self):
        self.assertEqual(self.call("/runtime/api/calculate")["status"], "405 Method Not Allowed")
        self.assertEqual(self.call("/runtime/api/calculate", "POST", b"{}", "text/plain")["status"], "415 Unsupported Media Type")
        self.assertEqual(self.call("/runtime/api/calculate", "POST", length=40000)["status"], "413 Payload Too Large")
        for body in (b"{", b"[]", b'{"load":NaN}', b'{"load":1,"load":2}', b'{}'):
            self.assertEqual(self.call("/runtime/api/calculate", "POST", body)["status"], "400 Bad Request")

    def test_browser_cannot_replace_catalog(self):
        request = dict(EXAMPLES["runtime"]["request"], dataset={"origin": "new_shared_dataset"})
        self.assertEqual(self.call("/runtime/api/calculate", "POST", json.dumps(request).encode())["status"], "400 Bad Request")


if __name__ == "__main__":
    unittest.main()
