import numpy as np


class Connection:
    _innovation_counter = 0

    def __init__(self, from_neuron, to_neuron, weight, enabled=True):
        self.from_neuron = from_neuron
        self.to_neuron = to_neuron
        self.weight = weight
        self.enabled = enabled
        self.innovation = Connection._innovation_counter
        Connection._innovation_counter += 1


class Neuron:
    def __init__(self, value=0.0, bias=0.0):
        self.value = value
        self.bias = bias
        self.incoming_connections = []
        self.outgoing_connections = []

    def activate(self, x):
        return 1 / (1 + np.exp(-x))

    def execute(self):
        self.value += self.bias
        activated = self.activate(self.value)
        for conn in self.outgoing_connections:
            if conn.enabled:
                conn.to_neuron.value += activated * conn.weight


class NeuralNetwork:
    def __init__(self):
        self.neurons = []
        self.connections = []

    def add_neuron(self, neuron):
        self.neurons.append(neuron)

    def add_connection(self, from_neuron, to_neuron, weight, enabled=True):
        conn = Connection(from_neuron, to_neuron, weight, enabled)
        from_neuron.outgoing_connections.append(conn)
        to_neuron.incoming_connections.append(conn)
        self.connections.append(conn)
        return conn

    def sort_neurons(self):
        in_degree = {n: len(n.incoming_connections) for n in self.neurons}
        queue = [n for n in self.neurons if in_degree[n] == 0]
        sorted_neurons = []
        while queue:
            neuron = queue.pop(0)
            sorted_neurons.append(neuron)
            for conn in neuron.outgoing_connections:
                in_degree[conn.to_neuron] -= 1
                if in_degree[conn.to_neuron] == 0:
                    queue.append(conn.to_neuron)
        self.neurons = sorted_neurons

    def execute(self):
        for neuron in self.neurons:
            if neuron.incoming_connections:
                neuron.value = 0.0
        for neuron in self.neurons:
            neuron.execute()

    # --- NEAT mutations ---

    def mutate_weight(self, sigma=0.1):
        for conn in self.connections:
            conn.weight += np.random.randn() * sigma

    def mutate_add_connection(self, weight=None):
        weight = weight if weight is not None else np.random.randn()
        # Find pairs that aren't already connected
        existing = {(c.from_neuron, c.to_neuron) for c in self.connections}
        candidates = [
            (a, b)
            for a in self.neurons
            for b in self.neurons
            if a is not b and (a, b) not in existing
        ]
        if not candidates:
            return None
        from_neuron, to_neuron = candidates[np.random.randint(len(candidates))]
        return self.add_connection(from_neuron, to_neuron, weight)

    def mutate_add_node(self):
        if not self.connections:
            return
        conn = self.connections[np.random.randint(len(self.connections))]
        conn.enabled = False
        new_neuron = Neuron(bias=0.0)
        self.add_neuron(new_neuron)
        self.add_connection(conn.from_neuron, new_neuron, weight=1.0)
        self.add_connection(new_neuron, conn.to_neuron, weight=conn.weight)
        self.sort_neurons()
        return new_neuron
