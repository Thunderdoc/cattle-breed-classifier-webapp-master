import yaml
import sys
import ast
from pathlib import Path
from io import BytesIO
from typing import List, Dict, Union, ByteString, Any
import os
from PIL import Image
from flask import Flask, render_template, request, jsonify
import requests
import torch
import json
import wget
import aiohttp
import asyncio
import uvicorn
import nest_asyncio
import warnings
import gdown
from torchvision import transforms, models
import torchvision.models.resnet
from torch.nn.modules.conv import Conv2d
warnings.filterwarnings("ignore")
print("Imports Done")

torch.serialization.add_safe_globals([torchvision.models.resnet.ResNet, Conv2d])

nest_asyncio.apply()
export_file_url = 'https://drive.google.com/u/0/uc?id=1x5Ljh9xtNfXFMm97AMlewW1nZ77XS-gb&export=download'
export_file_name = 'cattle_breed_classifier_full_model.pth'
path = Path("models/")
export_classes_url = "https://drive.google.com/u/0/uc?id=1IaF_zn-RDnsEntYp86F5G7FNlEkQ8KJ_&export=download"
export_classes_name = "classes.txt"

async def download_file(url, dest):
    if dest.exists(): return
    gdown.download(url, str(dest), quiet=False)
                
async def setup_learner():
    await download_file(export_file_url, path / export_file_name)
    await download_file(export_classes_url, path / export_classes_name)
    try:
        loaded = torch.load(path / export_file_name, map_location=torch.device('cpu'), weights_only=False)
        if isinstance(loaded, dict) and "state_dict" in loaded:
            model_arch = models.resnet18(pretrained=False)
            num_ftrs = model_arch.fc.in_features
            model_arch.fc = torch.nn.Linear(num_ftrs, len(open(path / export_classes_name).read().split(",")))
            state_dict = loaded["state_dict"]
            model_arch.load_state_dict(state_dict)
            model_arch.eval()
            model_final = model_arch
        else:
            model_final = loaded
        with open(path / export_classes_name, 'r') as file:
             class_list = file.read().split(",")
        return model_final, class_list
    except Exception as e:
        print(e)
        raise

loop = asyncio.get_event_loop()
tasks = [asyncio.ensure_future(setup_learner())]
model, class_list = loop.run_until_complete(asyncio.gather(*tasks))[0]

with open("config.yaml", 'r') as stream:
    APP_CONFIG = yaml.full_load(stream)

app = Flask(__name__, static_folder='static', template_folder='templates')


def load_model(path=".", model_name="cattle_breed_classifier_full_model.pth"):
    loaded = torch.load(export_file_name, map_location=torch.device('cpu'), weights_only=False)
    if isinstance(loaded, dict) and "state_dict" in loaded:
        model_arch = models.resnet18(pretrained=False)
        num_ftrs = model_arch.fc.in_features
        model_arch.fc = torch.nn.Linear(num_ftrs, len(open("models/classes.txt").read().split(",")))
        state_dict = loaded["state_dict"]
        model_arch.load_state_dict(state_dict)
        model_arch.eval()
        return model_arch
    else:
        return loaded


def load_image_url(url: str) -> Image:
    response = requests.get(url)
    img = Image.open(BytesIO(response.content))
    return img


def load_image_bytes(raw_bytes: ByteString) -> Image:
    img = Image.open(BytesIO(raw_bytes))
    return img


def predict(img, n: int = 3) -> Dict[str, Union[str, List]]:

    transform = transforms.Compose([
        transforms.Resize((224, 224)), 
        transforms.ToTensor(), 
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    outputs = model(transform(img).unsqueeze(0)).squeeze()
    pred_probs = torch.nn.Softmax(dim=-1)(outputs)
    _, pred_class = torch.max(pred_probs, dim=0)
    pred_probs = pred_probs.tolist()
    predictions = []
    for image_class, output, prob in zip(class_list, outputs.tolist(), pred_probs):
        output = round(output, 1)
        prob = round(prob, 2)
        predictions.append(
            {"class": image_class.replace("_", " "), "output": output, "prob": round(prob, 2)}
        )
    predictions = sorted(predictions, key=lambda x: x["output"], reverse=True)
    predictions = predictions[0:n]
    print({"class": str(pred_class.item()), "predictions": predictions})
    return {"class": str(pred_class.item()), "predictions": predictions}


@app.route('/api/classify', methods=['POST', 'GET'])
def upload_file():
    if request.method == 'GET':
        url = request.args.get("url")
        img = load_image_url(url)
    else:
        bytes = request.files['file'].read()
        img = load_image_bytes(bytes)
    res = predict(img)
    return jsonify(res)


@app.route('/api/classes', methods=['GET'])
def classes():
    with open('models/classes.txt', 'r') as file:
        classes = file.read().split(",")
    return jsonify(classes)


@app.route('/ping', methods=['GET'])
def ping():
    return "pong"


@app.route('/config')
def config():
    return jsonify(APP_CONFIG)


@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, public, max-age=0"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    response.cache_control.max_age = 0
    return response


@app.route('/<path:path>')
def static_file(path):
    if ".js" in path or ".css" in path:
        return app.send_static_file(path)
    else:
        return render_template('index.html')

@app.route('/')
def root():
    return render_template('index.html')


def before_request():
    app.jinja_env.cache = {}


if __name__ == '__main__':
    port = os.environ.get('PORT', 5001)

    if "prepare" not in sys.argv:
        app.jinja_env.auto_reload = True
        app.config['TEMPLATES_AUTO_RELOAD'] = True
        app.run(debug=False, host='0.0.0.0', port=port)